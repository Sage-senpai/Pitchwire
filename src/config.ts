import "dotenv/config";
import { z } from "zod";

/**
 * Environment schema. Everything that crosses the process boundary is validated
 * here, once, at boot. A bot that starts with a missing key and dies three hours
 * into a match is the worst failure mode we have — so we fail loud, at startup.
 */
const EnvSchema = z.object({
  // Telegram. Required to run the BOT, but not to run the one-time setup
  // scripts (`activate`), so it is asserted in assertBotEnv() rather than here.
  TELEGRAM_BOT_TOKEN: z.string().default(""),

  // Anthropic (the explanation layer). Same: required for the bot, not for setup.
  ANTHROPIC_API_KEY: z.string().default(""),
  // The explainer is the product — default to the strongest model. Swappable to
  // a faster tier (e.g. claude-haiku-4-5) for the live demo without touching code.
  EXPLAINER_MODEL: z.string().default("claude-opus-4-8"),

  // TxLINE / Solana — devnet, free World Cup tier
  TXLINE_NETWORK: z.enum(["devnet", "mainnet"]).default("devnet"),
  SOLANA_RPC_URL: z.string().url().default("https://api.devnet.solana.com"),
  TXLINE_API_ORIGIN: z.string().url().default("https://txline-dev.txodds.com"),

  // Base58 secret key of the service wallet that signs the one subscribe tx.
  // Only ever holds a small devnet SOL airdrop for fees. Never holds user funds.
  // Optional at boot so the bot can run before the one-time activation is done.
  SERVICE_WALLET_SECRET: z.string().optional(),

  // A cached API token from a completed activation. Set after running `npm run activate`.
  TXLINE_API_TOKEN: z.string().optional(),

  // Runtime
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  DATABASE_PATH: z.string().default("data/pitchwire.db"),
});

export type Config = z.infer<typeof EnvSchema>;

function loadConfig(): Config {
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    // Fail loud, fail at boot.
    console.error("Pitchwire cannot start — environment is invalid:\n" + issues);
    console.error("\nCopy .env.example to .env and fill in the required values.");
    process.exit(1);
  }
  return parsed.data;
}

export const config = loadConfig();

/**
 * Assert the env the BOT PROCESS needs. Called from index.ts so the bot still
 * fails loud at boot on a missing key — a bot that starts half-configured and
 * dies three hours into a match is the failure mode we refuse to have.
 *
 * The one-time setup scripts (`npm run activate`) deliberately do NOT call this:
 * they need the Solana wallet, not the Telegram or Anthropic keys, and making
 * them demand credentials they never use is pure friction.
 */
export function assertBotEnv(): void {
  const missing: string[] = [];
  if (!config.TELEGRAM_BOT_TOKEN) missing.push("TELEGRAM_BOT_TOKEN (from @BotFather)");
  if (!config.ANTHROPIC_API_KEY) missing.push("ANTHROPIC_API_KEY (the explanation layer)");
  if (missing.length === 0) return;

  console.error(
    "Pitchwire cannot start — missing required environment:\n" +
      missing.map((m) => `  - ${m}`).join("\n") +
      "\n\nSee SETUP.md. Copy .env.example to .env and fill these in."
  );
  process.exit(1);
}
