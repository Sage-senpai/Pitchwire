import type { Register } from "../deps.js";
import { PARSE_MODE, STOPPED } from "../render.js";

export const registerStop: Register = (bot, { store }) => {
  bot.command("stop", async (ctx) => {
    if (ctx.from) store.unsubscribeAll(ctx.from.id);
    // No guilt-trip, no retention play. Just confirm.
    await ctx.reply(STOPPED, { parse_mode: PARSE_MODE });
  });
};
