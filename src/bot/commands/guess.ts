import { InlineKeyboard } from "grammy";
import type { Register } from "../deps.js";
import type { Direction } from "../../store/db.js";
import {
  PARSE_MODE,
  guessAlready,
  guessCommitted,
  guessNoMatch,
  guessNoRound,
  guessPrompt,
} from "../render.js";

/**
 * /guess — the predict game. Shows the current game-stat value and two buttons.
 * A tap commits a guess to the currently-open round (see the sequence lock in
 * store.ts). If no round is open, we say so plainly rather than accept a dead
 * guess.
 */
export const registerGuess: Register = (bot, { store, engine }) => {
  bot.command("guess", async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;
    const fixtureId = store.getWatching(userId);
    if (fixtureId == null) {
      await ctx.reply(guessNoMatch(), { parse_mode: PARSE_MODE });
      return;
    }
    const round = store.getOpenRound(fixtureId);
    if (!round) {
      await ctx.reply(guessNoRound(), { parse_mode: PARSE_MODE });
      return;
    }
    const label = engine.getFixtureLabel(fixtureId);
    const value = engine.currentGameValue(fixtureId) ?? round.baselineValue;
    const kb = new InlineKeyboard()
      .text("Higher", "guess:higher")
      .text("Same or lower", "guess:same_or_lower");
    await ctx.reply(guessPrompt(label, round.stat, value), {
      parse_mode: PARSE_MODE,
      reply_markup: kb,
    });
  });

  bot.callbackQuery(/^guess:(higher|same_or_lower)$/, async (ctx) => {
    const userId = ctx.from?.id;
    const dir = ctx.match![1] as Direction;
    if (!userId) return;
    const fixtureId = store.getWatching(userId);
    if (fixtureId == null) {
      await ctx.answerCallbackQuery();
      await ctx.reply(guessNoMatch(), { parse_mode: PARSE_MODE });
      return;
    }
    const outcome = store.commitGuess(userId, fixtureId, dir);
    if (outcome.ok) {
      await ctx.answerCallbackQuery({ text: "Locked." });
      await ctx.reply(guessCommitted(dir), { parse_mode: PARSE_MODE });
    } else {
      const text = outcome.reason === "already_guessed" ? guessAlready() : guessNoRound();
      await ctx.answerCallbackQuery();
      await ctx.reply(text, { parse_mode: PARSE_MODE });
    }
  });
};
