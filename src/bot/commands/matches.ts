import { InlineKeyboard } from "grammy";
import type { Register } from "../deps.js";
import { PARSE_MODE, noMatchesLive, watchConfirm } from "../render.js";

/**
 * /matches — list followable World Cup fixtures as tappable buttons.
 * Tapping a match follows it (the /watch behaviour). Also reachable from the
 * "See what's live" button on /start via the `matches` callback.
 */
export const registerMatches: Register = (bot, { engine, store }) => {
  async function sendMatchList(reply: (text: string, kb: InlineKeyboard) => Promise<unknown>) {
    const matches = engine.listMatches();
    if (matches.length === 0) {
      await reply(noMatchesLive(), new InlineKeyboard());
      return;
    }
    const kb = new InlineKeyboard();
    for (const m of matches) {
      const dot = m.live ? "🟠 " : "";
      kb.text(`${dot}${m.label}`, `watch:${m.fixtureId}`).row();
    }
    await reply("<b>On the wire</b> — tap a match to follow it:", kb);
  }

  bot.command("matches", async (ctx) => {
    await sendMatchList((text, kb) => ctx.reply(text, { parse_mode: PARSE_MODE, reply_markup: kb }));
  });

  bot.callbackQuery("matches", async (ctx) => {
    await ctx.answerCallbackQuery();
    await sendMatchList((text, kb) => ctx.reply(text, { parse_mode: PARSE_MODE, reply_markup: kb }));
  });

  // Follow a match (from a tapped button).
  bot.callbackQuery(/^watch:(\d+)$/, async (ctx) => {
    const fixtureId = Number(ctx.match![1]);
    if (ctx.from) store.watchFixture(ctx.from.id, fixtureId);
    const label = engine.getFixtureLabel(fixtureId);
    await ctx.answerCallbackQuery({ text: "On the wire." });
    await ctx.reply(watchConfirm(label), { parse_mode: PARSE_MODE });
  });

  // Bare /watch nudges toward the tappable list.
  bot.command("watch", async (ctx) => {
    await ctx.reply("Pick a match from /matches to follow it.");
  });
};
