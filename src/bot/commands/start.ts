import { InlineKeyboard } from "grammy";
import type { Register } from "../deps.js";
import { PARSE_MODE, START } from "../render.js";

export const registerStart: Register = (bot, { store }) => {
  bot.command("start", async (ctx) => {
    if (ctx.from) store.upsertUser(ctx.from.id);
    const kb = new InlineKeyboard().text("See what's live", "matches");
    await ctx.reply(START, { parse_mode: PARSE_MODE, reply_markup: kb });
  });
};
