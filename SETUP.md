# Pitchwire — setup & run

A step-by-step runbook from a fresh clone to a live, deployed bot. Every command and variable here matches this codebase. Commands are shown for **Git Bash** (works on Windows too); PowerShell notes are added where they differ.

Total time: ~30–40 min, most of it the one-time TxLINE activation.

---

## 0. What you need

- **Node.js 20 or newer** (uses the global `fetch` for SSE). Check: `node -v`.
- **A C/C++ build toolchain** for `better-sqlite3`'s native build. On Windows this comes with the "Desktop development with C++" workload (Visual Studio Build Tools); on macOS, Xcode CLT; on Linux, `build-essential`. If `npm install` fails on `better-sqlite3`, this is why.
- **A Telegram account** (to talk to BotFather).
- **An Anthropic API key** (for the explanation layer).
- **The Solana CLI** is optional but the easiest way to airdrop devnet SOL. Alternatively use the web faucet (step 4).

You do **not** need real money anywhere. The only chain interaction is one free devnet transaction.

---

## 1. Clone & install

```bash
git clone https://github.com/Sage-senpai/pitchwire.git
cd pitchwire
npm install
```

Then create your env file:

```bash
cp .env.example .env      # PowerShell: copy .env.example .env
```

Leave it open — you'll fill it across the next steps.

---

## 2. Create the Telegram bot (BotFather)

1. In Telegram, open a chat with **@BotFather**.
2. Send `/newbot`, follow the prompts (name, then a username ending in `bot`).
3. BotFather replies with a **token** like `1234567890:AA...`. Put it in `.env`:
   ```
   TELEGRAM_BOT_TOKEN=1234567890:AA...
   ```

Now set the profile (this shows in the demo — a blank bot reads as unfinished):

- `/setdescription` — the pre-start pitch, in voice:
  > The live World Cup wire. I read the match and the market and tell you what just changed.
- `/setabouttext` — the short line:
  > The live World Cup wire.
- `/setuserpic` — upload an avatar. Rasterize the provided SVG to PNG first:
  ```bash
  # needs rsvg-convert (librsvg), or open web/assets/avatar.svg in any editor and export at 512×512
  rsvg-convert -w 512 -h 512 web/assets/avatar.svg -o web/assets/avatar.png
  ```
- `/setcommands` — **optional.** Pitchwire registers its command list automatically at boot (`setMyCommands`), so autocomplete works without this. If you want to set it by hand anyway, paste:
  ```
  start - Get on the wire
  matches - What's live right now
  watch - Follow a live match
  guess - Play the next-stat game
  streak - See your run
  stop - Leave the wire
  ```

---

## 3. Anthropic API key

Get a key from the Anthropic console and add it:

```
ANTHROPIC_API_KEY=sk-ant-...
```

Optional: `EXPLAINER_MODEL` defaults to `claude-opus-4-8`. For a faster/cheaper live demo you can switch it (e.g. `claude-haiku-4-5`) without touching code. Without a valid key the bot still runs — explanations fall back to plain templated sentences.

---

## 4. Activate TxLINE (the one on-chain step)

This is done **once**. It signs a single free devnet `subscribe` transaction with a throwaway service wallet, then activates a non-expiring API token. That token is all the running bot needs.

### 4a. Make a devnet service wallet

Generate a keypair and print its public key and base58 secret (uses deps already installed):

```bash
node -e "const {Keypair}=require('@solana/web3.js');const a=require('@coral-xyz/anchor');const kp=Keypair.generate();console.log('PUBKEY       ',kp.publicKey.toBase58());console.log('SECRET_BASE58',a.utils.bytes.bs58.encode(kp.secretKey));"
```

Put the secret in `.env` (this wallet only ever holds a small devnet airdrop — never user funds):

```
SERVICE_WALLET_SECRET=<the SECRET_BASE58 value>
```

### 4b. Fund it with devnet SOL

With the Solana CLI:

```bash
solana airdrop 2 <PUBKEY> --url https://api.devnet.solana.com
```

No CLI? Paste the pubkey into the web faucet at **https://faucet.solana.com** (select devnet).

### 4c. Run activation

```bash
npm run activate
```

On success it prints:

```
TXLINE_API_TOKEN=<long token>
```

Copy that into `.env`:

```
TXLINE_API_TOKEN=<long token>
```

> If activation fails with a 403, it's almost always a *same-network* mismatch — the wallet, RPC, program, and API host must all be devnet. Confirm `TXLINE_NETWORK=devnet`, `SOLANA_RPC_URL=https://api.devnet.solana.com`, `TXLINE_API_ORIGIN=https://txline-dev.txodds.com`, and that the wallet from 4a is the one that got the airdrop. See `docs/02-txline-reference.md`.

---

## 5. Fill in `.env` — final check

Your `.env` should now have all of these:

```
TELEGRAM_BOT_TOKEN=...        # required
ANTHROPIC_API_KEY=...         # required (bot runs without it, using templated fallback)
TXLINE_NETWORK=devnet
SOLANA_RPC_URL=https://api.devnet.solana.com
TXLINE_API_ORIGIN=https://txline-dev.txodds.com
SERVICE_WALLET_SECRET=...     # only used by `npm run activate`
TXLINE_API_TOKEN=...          # required for live data
LOG_LEVEL=info
DATABASE_PATH=data/pitchwire.db
```

The two hard requirements to boot are `TELEGRAM_BOT_TOKEN` and `ANTHROPIC_API_KEY` — the app fails loud at startup if either is missing. Without `TXLINE_API_TOKEN` it still boots, but with no live data (it warns and tells you to run `npm run activate`).

---

## 6. Run locally & test

```bash
npm run start        # or: npm run dev  (auto-restarts on file changes)
```

You should see a log line like:

```
INFO  Pitchwire is on the line. {"bot":"YourBotName","liveData":true}
```

Now open your bot in Telegram and send **`/start`** — you should get the on-the-wire greeting with a "See what's live" button. Try `/matches`, follow one, then `/guess`.

Also run the game-lock test to confirm the un-gameable mechanic:

```bash
npm run test:game
```

---

## 7. Verify the full loop with replay (between matches)

You don't have to wait for a live match to see the whole pipeline. Pick a World Cup fixture that **finished 6h–2wk ago** and replay its real sequence:

```bash
npm run replay -- <fixtureId>
```

It streams the decoded read-outs and game settlements to the console. To record it in a **real Telegram chat** (a solid backup demo), set your chat id first:

```bash
# Git Bash
REPLAY_CHAT_ID=<your-telegram-id> npm run replay -- <fixtureId>
# PowerShell
$env:REPLAY_CHAT_ID="<your-telegram-id>"; npm run replay -- <fixtureId>
```

(Your Telegram numeric id: message **@userinfobot**. You must have pressed /start on your bot first.) Adjust pacing with `REPLAY_DELAY_MS` (default 1500).

---

## 8. Deploy (always-on)

Pitchwire is a single long-lived Node process (SSE needs a persistent connection — **not** serverless). Railway or Fly.io both work.

**Railway (simplest):**
1. New Project → Deploy from your GitHub repo.
2. Add all the `.env` variables from step 5 in the service's **Variables** tab.
3. Set the start command to `npm run start`.
4. (Recommended) Add a **Volume** mounted at `/app/data` so the SQLite file survives redeploys — otherwise streaks/users reset on each deploy. That maps to `DATABASE_PATH=data/pitchwire.db`.
5. Deploy. Watch the logs for `Pitchwire is on the line.` and `Resolved World Cup fixtures`.

Keep it running through the whole judging window — a dead bot fails the completeness bar instantly. A simple uptime monitor (e.g. a free UptimeRobot ping, or just check the logs) is worth setting up.

---

## 9. Deploy the landing page

`web/index.html` is fully self-contained (inline CSS, no external requests), so any static host works — Netlify, Cloudflare Pages, GitHub Pages. Before you publish it:

1. Replace the demo `.video` block with your recorded demo `<iframe>` (16:9).
2. Update both `t.me/PitchwireBot` links to your real bot handle.
3. Update the "Read the code" GitHub link.

This deployed page is the judge-facing submission link.

---

## 10. Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `Pitchwire cannot start — environment is invalid` | Missing `TELEGRAM_BOT_TOKEN` or `ANTHROPIC_API_KEY` in `.env`. |
| Bot never replies to `/start` | Wrong token, or the process isn't running. Confirm the `Pitchwire is on the line.` log line and that the token matches BotFather's. |
| Log says `TXLINE_API_TOKEN not set — running without live data` | You haven't activated. Do step 4, paste the token, restart. |
| `/matches` says the wire is quiet | No World Cup fixture is live/known yet. Check the boot log `Resolved World Cup fixtures {count,...}` — count 0 means the token works but nothing is live right now (normal between matches; use `npm run replay`). |
| Activation fails with 403 | Same-network mismatch or unfunded wallet — see the note in step 4c. |
| Repeated `401 from TxLINE` in logs | The guest JWT is renewed automatically on 401; if it never clears, your `TXLINE_API_TOKEN` is wrong or was activated on a different network. |
| `npm install` fails on `better-sqlite3` | Missing C++ build tools — see step 0. |
| Explanations look like plain one-liners with no flair | The LLM call failed (bad/absent `ANTHROPIC_API_KEY`) and fell back to templates. Check the key. |

---

That's the whole path: **install → BotFather → Anthropic key → activate → `.env` → run → replay → deploy.** For deeper detail on any layer, the phase docs in `docs/` go further (`04` for the bot, `02` for TxLINE, `07` for the demo and submission).
