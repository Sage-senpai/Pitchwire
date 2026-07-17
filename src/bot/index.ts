import { Bot, InlineKeyboard } from "grammy";
import { log } from "../lib/log.js";
import type { Store } from "../store/db.js";
import type { Engine, OutboundMessage } from "../engine/index.js";
import type { BotDeps } from "./deps.js";
import { getProofAnchor } from "../feed/proof.js";
import {
  PARSE_MODE,
  explanationMessage,
  gameResultMessage,
  readingPlaceholder,
  verifyMessage,
} from "./render.js";

/** Inline "verify this scoreline on-chain" button carried on each read-out. */
function verifyKeyboard(fixtureId: number, seq: number): InlineKeyboard {
  return new InlineKeyboard().text("◆ Verify on-chain", `verify:${fixtureId}:${seq}`);
}
import { registerStart } from "./commands/start.js";
import { registerMatches } from "./commands/matches.js";
import { registerGuess } from "./commands/guess.js";
import { registerStreak } from "./commands/streak.js";
import { registerStop } from "./commands/stop.js";
import { registerVerify } from "./commands/verify.js";

/** The command list registered with BotFather so they autocomplete. */
export const COMMANDS = [
  { command: "start", description: "Get on the wire" },
  { command: "matches", description: "What's live right now" },
  { command: "watch", description: "Follow a live match" },
  { command: "guess", description: "Play the next-stat game" },
  { command: "streak", description: "See your run" },
  { command: "verify", description: "Prove the score is on-chain" },
  { command: "stop", description: "Leave the wire" },
];

export function createBot(token: string, deps: BotDeps): Bot {
  const bot = new Bot(token);

  for (const register of [
    registerStart,
    registerMatches,
    registerGuess,
    registerStreak,
    registerVerify,
    registerStop,
  ]) {
    register(bot, deps);
  }

  // Tapping "◆ Verify on-chain" on a read-out: pull the proof for that exact
  // scoreline (fixture + seq) and post the on-chain anchor. Read-only.
  bot.callbackQuery(/^verify:(\d+):(\d+)$/, async (ctx) => {
    const m = ctx.match as RegExpMatchArray;
    const fixtureId = Number(m[1]);
    const seq = Number(m[2]);
    const label = deps.engine.getFixtureLabel(fixtureId);
    try {
      const anchor = await getProofAnchor(fixtureId, seq, "1,2");
      await ctx.answerCallbackQuery();
      await ctx.reply(verifyMessage(label, anchor), {
        parse_mode: PARSE_MODE,
        link_preview_options: { is_disabled: true },
      });
    } catch (err) {
      log.warn("verify callback failed", { fixtureId, seq, error: String(err) });
      await ctx.answerCallbackQuery({ text: "Couldn't pull the proof just now." });
    }
  });

  // Error boundary: a handler error must never crash the process or the feed.
  bot.catch((err) => {
    log.error("Bot handler error", { error: String(err.error) });
  });

  attachDelivery(bot, deps.engine);
  return bot;
}

/**
 * Wire engine OutboundMessages to the right Telegram chats. Failures per user
 * are isolated — one blocked chat must not stop the rest.
 *
 * For explanations we post a dateline placeholder, then edit in the signal —
 * the honest "streaming" pattern for a platform with no token streaming: the
 * read-out arrives on the wire and resolves in place.
 */
function attachDelivery(bot: Bot, engine: Engine): void {
  engine.on("message", (msg: OutboundMessage) => {
    if (msg.kind === "explanation") {
      for (const userId of msg.toUserIds) void deliverExplanation(bot, userId, msg);
    } else {
      void deliverGameResult(bot, msg);
    }
  });
}

async function deliverExplanation(
  bot: Bot,
  userId: number,
  msg: Extract<OutboundMessage, { kind: "explanation" }>
): Promise<void> {
  try {
    const sent = await bot.api.sendMessage(userId, readingPlaceholder(msg.label, msg.phase, msg.seq), {
      parse_mode: PARSE_MODE,
    });
    await bot.api.editMessageText(userId, sent.message_id, explanationMessage(msg), {
      parse_mode: PARSE_MODE,
      reply_markup: verifyKeyboard(msg.fixtureId, msg.seq),
    });
  } catch (err) {
    log.warn("Failed to deliver explanation", { userId, seq: msg.seq, error: String(err) });
  }
}

async function deliverGameResult(
  bot: Bot,
  msg: Extract<OutboundMessage, { kind: "game_result" }>
): Promise<void> {
  try {
    await bot.api.sendMessage(msg.toUserId, gameResultMessage(msg), { parse_mode: PARSE_MODE });
  } catch (err) {
    log.warn("Failed to deliver game result", { userId: msg.toUserId, error: String(err) });
  }
}
