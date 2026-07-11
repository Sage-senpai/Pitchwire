# Pitchwire

The live World Cup wire. It reads the match and the market and tells you what just changed.

Pitchwire is a Telegram bot for the 2026 World Cup, built on the [TxLINE](https://txline.txodds.com) live data feed. When something happens on the pitch or the odds move, it sends one clear message explaining what changed and what the market is signalling. It also runs a small predict-the-next-stat game with a guess window that locks server-side against the feed's own sequence, so it cannot be gamed.

It reads and explains. It does not hold funds, place bets, or touch any prediction market. That boundary is deliberate.

## Stack

- Node.js + TypeScript
- Telegram Bot API via `grammy`
- TxLINE World Cup free tier — SSE streams + REST snapshots, gated by a one-time Solana devnet subscription
- Anthropic API for the explanation layer
- SQLite (`better-sqlite3`)

## Build order

This repo is built in phases. If you are picking it up, read `CLAUDE.md` first, then `docs/00-start-here.md`, then work through `docs/01` to `docs/07` in order.

```
CLAUDE.md                  operating brief — read first
docs/00-start-here.md      orientation and phase map
docs/01-foundations.md     scaffold, env, hello-world bot
docs/02-txline-reference.md the data layer + real TxLINE endpoints
docs/03-architecture.md    system design + the un-gameable game
docs/04-bot-setup.md       the Telegram bot proper
docs/05-design.md          identity, palette, voice
docs/06-skills-routing.md  which skill for which task
docs/07-demo-and-submit.md demo script + submission checklist
docs/NOTES.md              parking lot for deferred ideas
```

## Running

```bash
npm install
cp .env.example .env   # then fill it in
npx tsx src/index.ts
```

See `docs/01-foundations.md` for environment setup and `docs/02-txline-reference.md` for the one-time TxLINE activation.
