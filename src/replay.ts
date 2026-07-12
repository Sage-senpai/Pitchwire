import { Bot } from "grammy";
import { config } from "./config.js";
import { log } from "./lib/log.js";
import { Store } from "./store/db.js";
import { Engine, type OutboundMessage } from "./engine/index.js";
import {
  getFixtures,
  getScoresHistorical,
  decodePhase,
  decodeStats,
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
    phase: decodePhase(u.gameState),
    gameStateRaw: u.gameState ?? null,
    stats: decodeStats(u),
  };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main(): Promise<void> {
  const fixtureId = Number(process.argv[2]);
  if (!Number.isFinite(fixtureId)) {
    console.error("Usage: npm run replay -- <fixtureId>");
    process.exit(1);
  }

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
    fixture ?? { FixtureId: fixtureId, Participant1: "Home", Participant2: "Away", StartTime: 0 },
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

  const history = await getScoresHistorical(fixtureId);
  if (history.length === 0) {
    console.error(
      "No historical events for that fixture. It must have started 6h–2wk ago."
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
