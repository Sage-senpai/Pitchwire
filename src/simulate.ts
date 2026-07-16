import { Bot } from "grammy";
import { EventEmitter } from "node:events";
import { config } from "./config.js";
import { log } from "./lib/log.js";
import { Store } from "./store/db.js";
import { Engine, type OutboundMessage } from "./engine/index.js";
import { decodeStat } from "./feed/decode.js";
import type { DecodedStat, FeedEvent, GamePhase } from "./feed/index.js";
import { explanationMessage, gameResultMessage, PARSE_MODE } from "./bot/render.js";

/**
 * SIMULATION — a hand-authored World Cup match driven through the REAL engine,
 * decode, significance, explainer, and game code. Same pipeline the live bot
 * uses; only the events are scripted instead of arriving from TxLINE.
 *
 *   npm run simulate
 *
 * This is a rehearsal / backup-demo tool, NOT live data. The shipped bot always
 * runs on the live feed. The architecture doc sanctions scripted events for
 * exactly this (exercising the loop without waiting for a live match). Set
 * REPLAY_CHAT_ID to also deliver into a real Telegram chat for a recordable run.
 */

const DELAY_MS = Number(process.env.SIM_DELAY_MS ?? 1400);
const CHAT_ID = process.env.REPLAY_CHAT_ID ? Number(process.env.REPLAY_CHAT_ID) : null;
const SUB_ID = CHAT_ID ?? 1;
const FIXTURE_ID = 9001; // synthetic

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const plain = (h: string) =>
  h.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");

// Build a score event's decoded stats from a compact spec.
interface StatSpec { gH?: number; gA?: number; yH?: number; yA?: number; rH?: number; rA?: number; cH?: number; cA?: number; }
function stats(s: StatSpec): DecodedStat[] {
  const map: [number, number | undefined][] = [
    [1, s.gH], [2, s.gA], [3, s.yH], [4, s.yA], [5, s.rH], [6, s.rA], [7, s.cH], [8, s.cA],
  ];
  return map.filter(([, v]) => v != null).map(([k, v]) => decodeStat(k, v as number));
}

let seq = 0;
const score = (phase: GamePhase, s: StatSpec): FeedEvent => ({
  kind: "score", fixtureId: FIXTURE_ID, seq: ++seq, ts: seq, phase,
  gameStateRaw: String(phase), stats: stats(s),
});
const odds = (mkt: { name: string; pct: number }[]): FeedEvent => ({
  kind: "odds", fixtureId: FIXTURE_ID, seq: ++seq, ts: seq, messageId: `m${seq}`,
  markets: {
    marketType: "Match Odds", period: "FT", inRunning: true,
    outcomes: mkt.map((o) => ({ name: o.name, price: 0, impliedPct: o.pct })),
  },
});

// Morocco (home) vs France (away) — mirrors the design-doc examples.
const MATCH: FeedEvent[] = [
  score("first_half", { gH: 0, gA: 0, cH: 0, cA: 0 }),          // kickoff (opens round)
  odds([{ name: "Morocco", pct: 42 }, { name: "Draw", pct: 30 }, { name: "France", pct: 38 }]),
  score("first_half", { gH: 0, gA: 0, cH: 2, cA: 1 }),          // corners tick (game moves)
  score("first_half", { gH: 0, gA: 1, cH: 2, cA: 2 }),          // France scores
  odds([{ name: "France", pct: 55 }, { name: "Draw", pct: 28 }, { name: "Morocco", pct: 17 }]), // favourite flips
  score("first_half", { gH: 0, gA: 1, cH: 3, cA: 3 }),          // corners
  score("first_half", { gH: 0, gA: 1, rH: 1, cH: 3, cA: 3 }),   // Morocco red card
  odds([{ name: "France", pct: 68 }, { name: "Draw", pct: 22 }, { name: "Morocco", pct: 10 }]), // swing toward France
  score("halftime", { gH: 0, gA: 1, rH: 1, cH: 4, cA: 4 }),     // halftime
  score("second_half", { gH: 0, gA: 1, rH: 1, cH: 5, cA: 6 }),  // corners
  score("second_half", { gH: 0, gA: 2, rH: 1, cH: 5, cA: 7 }),  // France scores again
  score("second_half", { gH: 0, gA: 2, rH: 1, cH: 6, cA: 8 }),  // corners
  score("ended", { gH: 0, gA: 2, rH: 1, cH: 6, cA: 8 }),        // full time
];

async function main(): Promise<void> {
  const store = new Store(":memory:");
  const engine = new Engine(store);
  engine.setFixtures([
    { FixtureId: FIXTURE_ID, Participant1: "Morocco", Participant2: "France", StartTime: 0 },
  ]);
  store.watchFixture(SUB_ID, FIXTURE_ID);

  const bot = CHAT_ID ? new Bot(config.TELEGRAM_BOT_TOKEN) : null;
  async function push(m: OutboundMessage): Promise<void> {
    if (!bot || CHAT_ID == null) return;
    const text = m.kind === "explanation" ? explanationMessage(m) : gameResultMessage(m);
    try { await bot.api.sendMessage(CHAT_ID, text, { parse_mode: PARSE_MODE }); }
    catch (err) { log.warn("Telegram push failed", { error: String(err) }); }
  }

  engine.on("message", (m) => {
    if (m.kind === "explanation") console.log("\n" + plain(explanationMessage(m)));
    else console.log("  " + plain(gameResultMessage(m)));
    void push(m);
  });

  const feed = new EventEmitter();
  engine.attach(feed as unknown as never);

  console.log(
    "SIMULATION — scripted World Cup match through the real engine (not live TxLINE data)." +
      (CHAT_ID ? ` → chat ${CHAT_ID}` : "") + "\n"
  );

  for (const ev of MATCH) {
    feed.emit("event", ev);
    if (ev.kind === "score" && store.getOpenRound(FIXTURE_ID)) {
      store.commitGuess(SUB_ID, FIXTURE_ID, "higher");
    }
    await sleep(DELAY_MS);
  }

  await sleep(500);
  const streak = store.getStreak(SUB_ID);
  console.log(`\nSimulation done. Best streak this run: ${streak.best}.`);
  store.close();
  process.exit(0);
}

main().catch((err) => { log.error("Simulation failed", { error: String(err) }); process.exit(1); });
