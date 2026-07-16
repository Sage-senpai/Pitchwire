import { EventEmitter } from "node:events";
import { log } from "../lib/log.js";
import { getFixtures } from "./client.js";
import { runStream, type StreamHandle } from "./streams.js";
import { decodeOdds, decodePhase, decodeStats, resolvePhase } from "./decode.js";
import {
  OddsUpdateSchema,
  ScoreUpdateSchema,
  type FeedEvent,
  type Fixture,
} from "./types.js";

export * from "./types.js";
export {
  getFixtures,
  getScoreSnapshot,
  getScoreSequence,
  getOddsSnapshot,
  getScoresHistorical,
} from "./client.js";
export {
  decodeStats,
  decodeOdds,
  decodePhase,
  resolvePhase,
  isLivePhase,
  totalCorners,
  totalStat,
} from "./decode.js";

/**
 * The Feed: authenticate, parse, decode, dedupe on `seq`, emit. Nothing else.
 * It does not explain, does not know Telegram exists, does not touch the game.
 * The engine subscribes with `feed.on("event", ...)`.
 *
 * World Cup filtering: the devnet example uses competitionId 72, but docs warn
 * against blindly assuming it. So we treat 72 as a default and CONFIRM it at
 * runtime by matching the fixture's `Competition` string, logging what we find.
 */

const DEFAULT_WORLD_CUP_COMPETITION_ID = 72;
const WORLD_CUP_NAME = /world\s*cup/i;

export class Feed extends EventEmitter {
  private handles: StreamHandle[] = [];
  private lastSeq = new Map<number, number>(); // fixtureId -> last score seq seen
  private lastOddsTs = new Map<number, number>(); // fixtureId -> last odds ts seen

  /** Start both SSE streams. Idempotent-ish: call once at boot. */
  start(): void {
    this.handles.push(runStream("scores", (p) => this.onScore(p)));
    this.handles.push(runStream("odds", (p) => this.onOdds(p)));
    log.info("Feed started (scores + odds streams)");
  }

  stop(): void {
    for (const h of this.handles) h.stop();
    this.handles = [];
  }

  /** Typed emit/on for FeedEvent. */
  override emit(event: "event", payload: FeedEvent): boolean {
    return super.emit(event, payload);
  }
  override on(event: "event", listener: (payload: FeedEvent) => void): this {
    return super.on(event, listener);
  }

  private onScore(payload: unknown): void {
    const parsed = ScoreUpdateSchema.safeParse(payload);
    if (!parsed.success) return; // not a score payload / malformed — skip quietly
    const u = parsed.data;

    // Dedupe on seq: a reconnect can replay events; never double-fire.
    const prev = this.lastSeq.get(u.fixtureId);
    if (prev != null && u.seq <= prev) return;
    this.lastSeq.set(u.fixtureId, u.seq);

    const event: FeedEvent = {
      kind: "score",
      fixtureId: u.fixtureId,
      seq: u.seq,
      ts: u.ts,
      phase: resolvePhase(u.gameState, u.statusId),
      gameStateRaw: u.gameState ?? null,
      stats: decodeStats(u),
    };
    this.emit("event", event);
  }

  private onOdds(payload: unknown): void {
    const parsed = OddsUpdateSchema.safeParse(payload);
    if (!parsed.success) return;
    const u = parsed.data;

    // Odds carry no seq; dedupe/ordering on Ts per fixture.
    const prev = this.lastOddsTs.get(u.FixtureId);
    if (prev != null && u.Ts < prev) return;
    this.lastOddsTs.set(u.FixtureId, u.Ts);

    const event: FeedEvent = {
      kind: "odds",
      fixtureId: u.FixtureId,
      seq: u.Ts,
      ts: u.Ts,
      messageId: u.MessageId ?? null,
      markets: decodeOdds(u),
    };
    this.emit("event", event);
  }
}

/** Is this fixture a World Cup fixture, by name or by the known competition id? */
export function isWorldCup(fx: Fixture): boolean {
  if (fx.Competition && WORLD_CUP_NAME.test(fx.Competition)) return true;
  return fx.CompetitionId === DEFAULT_WORLD_CUP_COMPETITION_ID;
}

/**
 * Fetch fixtures and keep only World Cup ones. Logs the resolved competition id
 * so we can confirm the 72 assumption against live data rather than trusting it.
 */
export async function getWorldCupFixtures(): Promise<Fixture[]> {
  const all = await getFixtures();
  const wc = all.filter(isWorldCup);
  const ids = new Set(wc.map((f) => f.CompetitionId).filter((v) => v != null));
  log.info("Resolved World Cup fixtures", {
    count: wc.length,
    competitionIds: [...ids],
  });
  return wc;
}

export const feed = new Feed();
