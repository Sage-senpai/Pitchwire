import { Bot } from "grammy";
import { config } from "./config.js";
import { log } from "./lib/log.js";

/**
 * Phase 01 entry point: prove the floor.
 * Later phases wire the feed, the engine, and the full bot in here.
 */
const bot = new Bot(config.TELEGRAM_BOT_TOKEN);

bot.command("start", (ctx) =>
  ctx.reply("Pitchwire is on the line. The real thing is coming.")
);

bot.catch((err) => log.error("Bot error", { error: String(err.error) }));

async function main(): Promise<void> {
  await bot.init();
  log.info("Pitchwire bot is running.", { username: bot.botInfo.username });
  bot.start();
}

main().catch((err) => {
  log.error("Fatal on startup", { error: String(err) });
  process.exit(1);
});
