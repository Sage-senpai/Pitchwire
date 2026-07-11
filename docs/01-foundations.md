# 01 — Foundations

Goal of this phase: a repo that builds, an environment that is wired, and a Telegram bot that replies to `/start`. Nothing clever. Just a floor to stand on.

Do not move to Phase 02 until `/start` gets a reply in a real Telegram chat.

## 1. Scaffold

```
pitchwire/
  src/
    index.ts            # process entry: starts the bot and the feed
    config.ts           # loads and validates env, exits loud if anything is missing
    bot/                # Telegram layer (Phase 04)
    feed/               # TxLINE layer (Phase 02)
    engine/             # explanation + game logic (Phase 03)
    store/              # SQLite access (Phase 03)
    lib/                # shared helpers (logging, time, formatting)
  docs/
  .env.example
  .env                  # never committed
  package.json
  tsconfig.json
```

Create the folders now even though most are empty. Structure is a decision; make it up front.

## 2. Dependencies

```bash
npm init -y
npm install grammy @anthropic-ai/sdk better-sqlite3 dotenv zod
npm install @coral-xyz/anchor @solana/web3.js @solana/spl-token axios tweetnacl
npm install -D typescript tsx @types/node @types/better-sqlite3
```

- `grammy` — Telegram bot framework. Clean, typed, actively maintained.
- `zod` — validate env and validate the shape of anything crossing a boundary (feed payloads, LLM output). Do not trust unvalidated external data.
- The Solana / anchor / tweetnacl set is only for the one-time TxLINE subscribe-and-activate. It is not user-facing.
- `tsx` runs TypeScript directly in dev without a build step.

## 3. tsconfig

Strict. No implicit any. This catches feed-shape mistakes at compile time, which is exactly where you want them caught rather than live during the final.

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

## 4. Environment

`.env.example` (commit this, with empty values):

```
# Telegram
TELEGRAM_BOT_TOKEN=

# Anthropic
ANTHROPIC_API_KEY=

# TxLINE / Solana (devnet for the free World Cup tier)
TXLINE_NETWORK=devnet
SOLANA_RPC_URL=https://api.devnet.solana.com
TXLINE_API_ORIGIN=https://txline-dev.txodds.com
# Base58 secret key of the service wallet that signs the one subscribe tx.
# This wallet only ever holds a small devnet SOL airdrop for fees. It never holds user funds.
SERVICE_WALLET_SECRET=

# Runtime
LOG_LEVEL=info
```

`config.ts` loads these with `zod` and **throws on startup** if any required one is missing. A bot that boots with a missing key and fails silently three hours into a match is the worst possible failure mode. Fail at boot, loudly.

## 5. Get the bot token

In Telegram, message `@BotFather`, send `/newbot`, follow the prompts, and paste the token into `.env`. Full BotFather walkthrough (commands, description, the profile that makes it look real for the demo) is in `docs/04-bot-setup.md` — but grab the token now so you can test.

## 6. Hello world

Minimal `src/index.ts` for this phase only:

```typescript
import { Bot } from "grammy";
import { config } from "./config.js";

const bot = new Bot(config.TELEGRAM_BOT_TOKEN);

bot.command("start", (ctx) =>
  ctx.reply("Pitchwire is on the line. The real thing is coming.")
);

bot.start();
console.log("Pitchwire bot is running.");
```

Run it: `npx tsx src/index.ts`. Open your bot in Telegram, send `/start`, confirm the reply. Once that works, commit:

```
git init
git add .
git commit -m "Foundations: scaffold, env validation, hello-world bot replying to /start"
```

Then open `02-txline-reference.md`.

## Guardrails for this phase

- Do not build any feature logic yet. Resist it.
- Do not commit `.env`. Add it to `.gitignore` in your first commit.
- If `config.ts` validation feels like overkill for two keys, keep it anyway. You will thank yourself when the env grows.
