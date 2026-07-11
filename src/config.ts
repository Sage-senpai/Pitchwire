import "dotenv/config";
import { z } from "zod";

/**
 * Environment schema. Everything that crosses the process boundary is validated
 * here, once, at boot. A bot that starts with a missing key and dies three hours
 * into a match is the worst failure mode we have — so we fail loud, at startup.
 */
const EnvSchema = z.object({
  // Telegram
  TELEGRAM_BOT_TOKEN: z.string().min(1, "TELEGRAM_BOT_TOKEN is required"),

  // Anthropic (the explanation layer)
  ANTHROPIC_API_KEY: z.string().min(1, "ANTHROPIC_API_KEY is required"),

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
