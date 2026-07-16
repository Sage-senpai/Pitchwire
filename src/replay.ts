import { Bot } from "grammy";
import { config } from "./config.js";
import { log } from "./lib/log.js";
import { Store } from "./store/db.js";
import { Engine, type OutboundMessage } from "./engine/index.js";
import {
  getFixtures,
  getScoresHistorical,
  getScoreSequence,
  resolvePhase,
  decodeStats,
  totalStat,
  totalCorners,
  type FeedEvent,
  type Fixture,
  type ScoreUpdate,
} from "./feed/index.js";
import { EventEmitter } from "node:events";
import {
  explanationMessage,
  gameResultMessage,
  PARSE_MODE,
} from "./bot/render.js";

/**
 * Historical replay — the between-matches testing and backup-demo lever.
 *
 *   npm run replay -- <fixtureId>
 *
 * It pulls a real, finished match's full score sequence from
 * /api/scores/historical, feeds it through the exact decode → significance →
 * explainer → game pipeline the live bot uses, and prints each read-out and
 * game settlement to the console. Set REPLAY_CHAT_ID to also deliver into a real
 * Telegram chat (so you can record the actual UI when no match is live).
 *
 * It auto-commits a "higher" guess each round so the un-gameable game settles on
 * screen too. Needs an activated TXLINE_API_TOKEN to fetch the history.
 */

const DELAY_MS = Number(process.env.REPLAY_DELAY_MS ?? 1500);
const CHAT_ID = process.env.REPLAY_CHAT_ID ? Number(process.env.REPLAY_CHAT_ID) : null;
const SUB_ID = CHAT_ID ?? 1; // the (real or dummy) subscriber that "watches" the match

function plain(html: string): string {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function toFeedEvent(u: ScoreUpdate): FeedEvent {
  return {
    kind: "score",
    fixtureId: u.fixtureId,
    seq: u.seq,
    ts: u.ts,
    phase: resolvePhase(u.gameState, u.statusId),
    gameStateRaw: u.gameState ?? null,
    stats: decodeStats(u),
  };
}

/**
 * Reduce a raw score sequence to the rows that actually move the match: keep a
 * row only when a tracked total (goals / cards / corners) or the live/ended
 * phase changes. Non-score events (possession, throw-ins) and empty-stat rows
 * would otherwise settle rounds on stale zeros.
 */
function meaningful(rows: ScoreUpdate[]): ScoreUpdate[] {
  const out: ScoreUpdate[] = [];
  let prevSig = "";
  for (const u of rows) {
    const s = decodeStats(u);
    const hasStats = s.length > 0;
    if (!hasStats) continue;
    const sig = [
      totalStat(s, 1), totalStat(s, 2), totalStat(s, 3), totalStat(s, 4),
      totalStat(s, 5), totalStat(s, 6), totalCorners(s),
      resolvePhase(u.gameState, u.statusId),
    ].join(":");
    if (sig === prevSig) continue;
    prevSig = sig;
    out.push(u);
  }
  return out;
}

/** Pull a real match's timeline: /historical first, else the snapshot array. */
async function loadSequence(fixtureId: number): Promise<ScoreUpdate[]> {
  const hist = await getScoresHistorical(fixtureId);
  const rows = hist.length ? hist : await getScoreSequence(fixtureId);
  return meaningful(rows);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main(): Promise<void> {
  const fixtureId = Number(process.argv[2]);
  if (!Number.isFinite(fixtureId)) {
    console.error("Usage: npm run replay -- <fixtureId> [homeName] [awayName]");
    process.exit(1);
  }
  const argHome = process.argv[3];
  const argAway = process.argv[4];

  const store = new Store(":memory:");
  const engine = new Engine(store);

  // Resolve the fixture label so read-outs name the teams.
  let fixture: Fixture | undefined;
  try {
    fixture = (await getFixtures()).find((f) => f.FixtureId === fixtureId);
  } catch (err) {
    log.warn("Could not fetch fixtures for label (continuing)", { error: String(err) });
  }
  engine.setFixtures([
    fixture ?? {
      FixtureId: fixtureId,
      Participant1: argHome ?? "Home",
      Participant2: argAway ?? "Away",
      StartTime: 0,
    },
  ]);

  // A subscriber must exist or the engine won't spend an explanation.
  store.watchFixture(SUB_ID, fixtureId);

  // Optional real Telegram delivery.
  const bot = CHAT_ID ? new Bot(config.TELEGRAM_BOT_TOKEN) : null;
  async function push(m: OutboundMessage): Promise<void> {
    if (!bot || CHAT_ID == null) return;
    const text =
      m.kind === "explanation" ? explanationMessage(m) : gameResultMessage(m);
    try {
      await bot.api.sendMessage(CHAT_ID, text, { parse_mode: PARSE_MODE });
    } catch (err) {
      log.warn("Telegram push failed", { error: String(err) });
    }
  }

  engine.on("message", (m) => {
    if (m.kind === "explanation") console.log("\n" + plain(explanationMessage(m)));
    else console.log("  " + plain(gameResultMessage(m)));
    void push(m);
  });

  const fakeFeed = new EventEmitter();
  engine.attach(fakeFeed as unknown as never);

  const history = await loadSequence(fixtureId);
  if (history.length === 0) {
    console.error(
      "No score events for that fixture yet (not started, or no data on this tier)."
    );
    process.exit(1);
  }
  console.log(
    `Replaying ${history.length} updates for ${engine.getFixtureLabel(fixtureId)} ` +
      `(${DELAY_MS}ms apart)${CHAT_ID ? ` → chat ${CHAT_ID}` : ""}\n`
  );

  for (const u of history) {
    fakeFeed.emit("event", toFeedEvent(u));
    // Auto-play the game: guess on the freshly opened round so it settles next tick.
    if (store.getOpenRound(fixtureId)) store.commitGuess(SUB_ID, fixtureId, "higher");
    await sleep(DELAY_MS);
  }

  await sleep(500); // let the last async explanation flush
  const streak = store.getStreak(SUB_ID);
  console.log(`\nReplay done. Best streak this run: ${streak.best}.`);
  store.close();
  process.exit(0);
}

main().catch((err) => {
  log.error("Replay failed", { error: String(err) });
  process.exit(1);
});
