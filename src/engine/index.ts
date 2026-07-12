import { EventEmitter } from "node:events";
import { log } from "../lib/log.js";
import { Store } from "../store/db.js";
import {
  isLivePhase,
  totalStat,
  type DecodedStat,
  type Feed,
  type FeedEvent,
  type Fixture,
  type GamePhase,
} from "../feed/index.js";
import { statValue } from "./game.js";
import {
  oddsSignificance,
  scoreSignificance,
  type OddsFavourite,
} from "./significance.js";
import { explain, type ExplainInput } from "./explainer.js";
import type { OutboundMessage } from "./types.js";

export * from "./types.js";
export { statValue, statLabel } from "./game.js";

// The single default stat the predict game tracks per fixture. Corners.
const GAME_STAT = "corners";

interface FixtureInfo {
  homeName: string; // Participant1 (home slot at a neutral venue)
  awayName: string; // Participant2
  label: string;
}

/**
 * The engine: the only place that decides what is worth telling a user. It
 * subscribes to FeedEvents, runs the deterministic significance filter, spends
 * an LLM call only when warranted, drives the sequence-locked game, and emits
 * OutboundMessages. It never talks to Telegram or the feed directly.
 */
export class Engine extends EventEmitter {
  private fixtures = new Map<number, FixtureInfo>();
  private lastStats = new Map<number, DecodedStat[]>();
  private lastPhase = new Map<number, GamePhase>();
  private lastFav = new Map<number, OddsFavourite | null>();

  constructor(private store: Store) {
    super();
  }

  /** Populate fixture labels so explanations can name the teams. */
  setFixtures(fixtures: Fixture[]): void {
    for (const fx of fixtures) {
      this.fixtures.set(fx.FixtureId, {
        homeName: fx.Participant1,
        awayName: fx.Participant2,
        label: `${fx.Participant1} vs ${fx.Participant2}`,
      });
    }
    log.info("Engine loaded fixtures", { count: this.fixtures.size });
  }

  getFixtureLabel(fixtureId: number): string {
    return this.fixtures.get(fixtureId)?.label ?? `fixture ${fixtureId}`;
  }

  /** Latest known value of the game stat for a fixture, for /guess display. */
  currentGameValue(fixtureId: number): number | null {
    const stats = this.lastStats.get(fixtureId);
    if (!stats) return null;
    return statValue(stats, GAME_STAT);
  }

  /** Wire the engine to a feed. Call once at boot. */
  attach(feed: Feed): void {
    feed.on("event", (ev) => this.handle(ev));
  }

  override emit(event: "message", payload: OutboundMessage): boolean {
    return super.emit(event, payload);
  }
  override on(event: "message", listener: (payload: OutboundMessage) => void): this {
    return super.on(event, listener);
  }

  private handle(ev: FeedEvent): void {
    try {
      if (ev.kind === "score") this.onScore(ev);
      else this.onOdds(ev);
    } catch (err) {
      // A single bad event must never take down the feed or the bot.
      log.error("Engine event handler error", { error: String(err), kind: ev.kind });
    }
  }

  private onScore(ev: Extract<FeedEvent, { kind: "score" }>): void {
    // Cross-restart dedupe: a reconnect that replays events must not double-fire.
    if (!this.store.markSeen(ev.fixtureId, ev.seq)) return;

    const prevStats = this.lastStats.get(ev.fixtureId) ?? null;
    const prevPhase = this.lastPhase.get(ev.fixtureId) ?? null;

    // 1) Settle the prior round FIRST — atomically, before we reveal the new
    //    value. Any guess not already committed is rejected by construction.
    const open = this.store.getOpenRound(ev.fixtureId);
    if (open) {
      const actual = statValue(ev.stats, open.stat);
      const settled = this.store.settleOpenRound(ev.fixtureId, actual);
      for (const s of settled) {
        this.emit("message", {
          kind: "game_result",
          toUserId: s.userId,
          stat: open.stat,
          direction: s.direction,
          baseline: open.baselineValue,
          actual,
          result: s.result,
          currentStreak: s.currentStreak,
          bestStreak: s.bestStreak,
        });
      }
    }

    // 2) Explanation, only if the change is significant.
    const sig = scoreSignificance(ev.stats, prevStats, ev.phase, prevPhase);
    if (sig.significant) {
      void this.emitExplanation(ev.fixtureId, ev.seq, ev.ts, ev.phase, ev.stats, sig.fact);
    }

    // 3) Open a new round for the next update, while the match is live.
    if (isLivePhase(ev.phase)) {
      this.store.openRound(ev.fixtureId, ev.seq, GAME_STAT, statValue(ev.stats, GAME_STAT));
    }

    this.lastStats.set(ev.fixtureId, ev.stats);
    this.lastPhase.set(ev.fixtureId, ev.phase);
  }

  private onOdds(ev: Extract<FeedEvent, { kind: "odds" }>): void {
    // Only reason about a match-winner-shaped market (2 or 3 outcomes).
    const n = ev.markets.outcomes.length;
    if (n < 2 || n > 3) return;

    const prevFav = this.lastFav.get(ev.fixtureId) ?? null;
    const sig = oddsSignificance(ev.markets, prevFav);
    this.lastFav.set(ev.fixtureId, sig.favourite);

    if (!sig.significant) return;
    const phase = this.lastPhase.get(ev.fixtureId) ?? "unknown";
    if (!isLivePhase(phase)) return; // don't narrate pre-match / finished odds churn

    const stats = this.lastStats.get(ev.fixtureId) ?? [];
    void this.emitExplanation(ev.fixtureId, ev.seq, ev.ts, phase, stats, "", sig.fact);
  }

  /** Build the explain input, run the (validated) explainer, emit to subscribers. */
  private async emitExplanation(
    fixtureId: number,
    seq: number,
    ts: number,
    phase: GamePhase,
    stats: DecodedStat[],
    fact: string,
    oddsFact?: string
  ): Promise<void> {
    const subs = this.store.getSubscribers(fixtureId);
    if (subs.length === 0) return; // no one is listening — don't spend a call

    const info = this.fixtures.get(fixtureId);
    const homeName = info?.homeName ?? "Home";
    const awayName = info?.awayName ?? "Away";
    const scoreLine = `${homeName} ${totalStat(stats, 1)} - ${totalStat(stats, 2)} ${awayName}`;

    const input: ExplainInput = {
      label: info?.label ?? `fixture ${fixtureId}`,
      homeName,
      awayName,
      scoreLine,
      phaseLabel: phase.replace("_", " "),
      fact: fact || oddsFact || "The market moved.",
      oddsFact: fact ? oddsFact : undefined, // if fact is empty, oddsFact already used as fact
    };

    const text = await explain(input);
    this.emit("message", {
      kind: "explanation",
      fixtureId,
      toUserIds: subs,
      label: input.label,
      phase,
      seq,
      ts,
      text,
    });
    log.info("Explanation emitted", { fixtureId, seq, subs: subs.length });
  }
}
