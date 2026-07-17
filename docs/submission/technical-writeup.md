# Pitchwire — technical write-up

## Core idea

A pitchwire was the telegraph line that carried match results back from the ground before radio. Pitchwire is that wire, brought back — a Telegram bot for the 2026 World Cup that reads the live match and the live market together and sends one clear signal when something changes. It is a read-and-explain product: it describes what the data shows and what the market is doing, and it never tells anyone to place a wager. That boundary is a deliberate design choice, not an afterthought — the builder is in Nigeria, where betting-adjacent framing carries real regulatory exposure, so "explain, never advise" is baked into the copy, the model's system prompt, and an automated banned-phrase guard.

## How it works

Five layers, each with one job, data flowing one way:

```
TxLINE (SSE + REST) → FEED → ENGINE ⇄ STORE(SQLite) → BOT → the fan's chat
```

- **Feed** authenticates, parses every payload through zod schemas, decodes the soccer stat encoding, dedupes on sequence number, and emits a single internal `FeedEvent`. It knows nothing about Telegram or the game.
- **Engine** is the only layer that decides what is worth telling a user. A deterministic significance filter runs in plain code first — a corner ticking 3→4 is not worth a message; a goal, a red card, a phase change, or an odds move past a threshold is. Only significant events reach the LLM.
- **Store** (SQLite via better-sqlite3) holds users, subscriptions, rounds, guesses, streaks, and a seen-event dedupe ledger.
- **Bot** (grammy) renders in Pitchwire's voice and delivers to subscribed chats.

## Technical highlights

**Live SSE with reconnect + JWT renewal.** The scores and odds streams are consumed with TxLINE's own SSE parser helper, wrapped in a reconnect-with-backoff loop that renews the guest JWT on every reconnect. This matters because TxLINE's two credentials behave differently: the guest JWT expires, the activated API token does not. A dropped stream that never reconnects — or a JWT that quietly expires mid-match — is a dead demo, so both are handled from the start, with a proactive background JWT refresh on top.

**The sequence-locked, un-gameable guess.** The predict game's anti-manipulation core is that the server owns the clock and the sequence, never the client. A round is keyed by the feed's own sequence number: when score `seq = N` arrives, a round opens for "what happens by the next update." The instant `seq = N+1` arrives, the engine closes that round atomically — inside a single SQLite transaction, before the new value is revealed or broadcast. Any guess not already committed is rejected by construction. Because the round key is the feed's sequence, there is no wall-clock timer to fake and no client clock to trust. This is verified by a scripted unit test (`npm run test:game`) that proves a guess committed to a closed round is rejected and that settlement scores and streaks correctly.

**Constrained explanation with a templated fallback.** The explainer is the product, so the quality budget goes here. The LLM is constrained hard by a system prompt that encodes the no-advice / no-invention / no-hype boundaries, and its output is validated after generation: empty, too-long, or banned-phrase output is discarded in favour of a plain templated sentence built from the decoded data. Unreviewed model text never reaches a user during a live match.

**Honest freshness.** Every value carries its `seq` and `ts`. We do not own TxLINE's data and don't pretend to — what we own is not introducing our own staleness, so we dedupe on sequence and surface the telemetry rather than dressing an old number up as live.

**On-chain proof of the scoreline (`/verify`).** This uses TxLINE's actual differentiator: the data is off-chain, but a daily Merkle root of every score is anchored on Solana. Tap **◆ Verify on-chain** on any read-out (or send `/verify`) and Pitchwire fetches the Merkle proof for that exact scoreline from `/api/scores/stat-validation`, derives the `daily_scores_roots` PDA for that day, reads it on devnet to confirm the root is anchored, and returns a Solana Explorer link. It is read-only — no transaction, no signing, no custody — so it stays inside the boundary while making the trust story concrete: the number on screen is provably TxLINE's own, not ours.

## TxLINE endpoints used

- `POST /auth/guest/start` — guest JWT
- `POST /api/token/activate` — activate the API token after the on-chain subscribe
- `GET /api/fixtures/snapshot` — fixtures, filtered to the World Cup competition (`competitionId=72`); `startEpochDay` pulls finished matches for between-window testing
- `GET /api/scores/snapshot/{fixtureId}` — the full score sequence for a fixture (returns the whole event array, not just the latest)
- `GET /api/scores/stream` — live scores over SSE
- `GET /api/odds/stream` — live odds over SSE (StablePrice, demargined `Pct`)
- `GET /api/scores/stat-validation` — the Merkle proof behind `/verify`
- Soccer stat encoding: `key = period_prefix + base_key`; base keys 7/8 (corners) drive the game.

The only on-chain write is a single `subscribe` transaction signed by our own service wallet on Solana **devnet** (free World Cup tier, Service Level 1). `/verify` additionally *reads* the `daily_scores_roots` PDA. No user funds are ever held, moved, or signed for.

## The trust story

Every displayed value carries its sequence number and timestamp; we dedupe on sequence so a reconnect that replays events never double-fires. And the authenticity we don't own — that's TxLINE's — `/verify` surfaces directly: the on-chain Merkle root that backs the number, with a Solana Explorer link a judge can click. Pitchwire adds no staleness of its own, and proves the rest is genuine rather than asking you to trust it.

## Stack

Node.js + TypeScript · grammy · better-sqlite3 · Anthropic API · TxLINE World Cup free tier (devnet SL1) · a single always-on process (SSE needs a long-lived connection, so not serverless).
