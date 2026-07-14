import { assertBotEnv, config } from "./config.js";
import { log } from "./lib/log.js";
import { Store } from "./store/db.js";
import { Engine } from "./engine/index.js";
import { feed, getWorldCupFixtures } from "./feed/index.js";
import { getJwt, hasApiToken } from "./feed/auth.js";
import { createBot, COMMANDS } from "./bot/index.js";

/**
 * Process entry. Data flows one way: feed -> engine -> bot. Failures are
 * isolated — an LLM error can't kill the feed, a feed hiccup can't crash the
 * bot. The bot always boots so a judge can open it; live data comes online once
 * the TxLINE token is activated (see docs/02, `npm run activate`).
 */

const REFRESH_FIXTURES_MS = 10 * 60 * 1000;
const RENEW_JWT_MS = 5 * 60 * 1000;

async function main(): Promise<void> {
  assertBotEnv(); // fail loud, at boot, before anything else spins up

  const store = new Store(config.DATABASE_PATH);
  const engine = new Engine(store);
  const bot = createBot(config.TELEGRAM_BOT_TOKEN, { store, engine });

  // Bring the live feed online only when we have an activated API token.
  if (hasApiToken()) {
    engine.attach(feed);
    try {
      const fixtures = await getWorldCupFixtures();
      engine.setFixtures(fixtures);
    } catch (err) {
      log.warn("Could not load fixtures at boot (will retry)", { error: String(err) });
    }
    feed.start();

    // Keep fixtures current and the guest JWT warm through a long match.
    setInterval(() => {
      getWorldCupFixtures()
        .then((fx) => engine.setFixtures(fx))
        .catch((err) => log.warn("Fixture refresh failed", { error: String(err) }));
    }, REFRESH_FIXTURES_MS);
    setInterval(() => {
      getJwt().catch((err) => log.warn("JWT keep-warm failed", { error: String(err) }));
    }, RENEW_JWT_MS);
  } else {
    log.warn(
      "TXLINE_API_TOKEN not set — running the bot without live data. " +
        "Run `npm run activate` to subscribe on devnet and activate the feed."
    );
  }

  await bot.init();
  await bot.api.setMyCommands(COMMANDS);
  log.info("Pitchwire is on the line.", {
    bot: bot.botInfo.username,
    liveData: hasApiToken(),
  });
  bot.start();

  const shutdown = () => {
    log.info("Shutting down");
    feed.stop();
    void bot.stop();
    store.close();
    process.exit(0);
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}

main().catch((err) => {
  log.error("Fatal on startup", { error: String(err) });
  process.exit(1);
});
