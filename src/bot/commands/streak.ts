import type { Register } from "../deps.js";
import { PARSE_MODE, streakMessage } from "../render.js";

export const registerStreak: Register = (bot, { store }) => {
  bot.command("streak", async (ctx) => {
    if (!ctx.from) return;
    const { current, best } = store.getStreak(ctx.from.id);
    await ctx.reply(streakMessage(current, best), { parse_mode: PARSE_MODE });
  });
};
