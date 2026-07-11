# 03 — Architecture

Goal of this phase: the system design and the two pieces of real logic — the explanation engine and the un-gameable predict game. By the end, a live feed event produces a real explanation, and a guess can be scored without any way to cheat it.

## The shape of the system

Five layers, each with one job, talking in one direction:

```
  TxLINE (SSE + REST)
        │
        ▼
  ┌───────────────┐
  │  FEED          │  authenticate, parse, decode, dedupe on seq
  │  (Phase 02)    │  emits FeedEvent
  └──────┬────────┘
         │ FeedEvent
         ▼
  ┌───────────────┐        ┌──────────────┐
  │  ENGINE        │───────▶│  STORE       │  SQLite: users, guesses,
  │                │◀───────│  (SQLite)    │  streaks, seen-events, rounds
  │  - explainer   │        └──────────────┘
  │  - game        │
  └──────┬────────┘
         │ OutboundMessage
         ▼
  ┌───────────────┐
  │  BOT           │  Telegram: send, format, buttons, commands
  │  (Phase 04)    │
  └──────┬────────┘
         │
         ▼
      The fan's chat
```

Data flows down. The bot never calls the feed directly. The feed never knows Telegram exists. The engine is the only place that decides what is worth telling a user. This separation is not ceremony — it is what lets you test each layer alone and swap any one without touching the others.

## The engine: two responsibilities

### 1. The explainer

Input: a `FeedEvent` (a decoded score change or odds move) plus a little context (the fixture, the previous state).

Output: one or two sentences a fan understands.

How it works:

- The engine decides **significance** first, in plain code, before spending an LLM call. A corner count ticking from 3 to 4 is not worth a message. A red card, a goal, or an odds move past a threshold is. Significance filtering is deterministic and cheap; do it in `engine/significance.ts`. Only significant events reach the LLM.
- For a significant event, build a tight prompt: here is what changed (decoded, human-readable), here is the score and phase, here is how the odds moved. Ask for one or two sentences explaining what happened and what the market is now signalling, in Pitchwire's voice. **Constrain the model hard**: no advice to bet, no invented facts, only what is in the payload, no hype. The system prompt for the explainer lives in `engine/explainer.ts` and must encode the boundaries from `CLAUDE.md`.
- Validate the LLM output before sending. If it is empty, too long, or trips a banned-phrase check (words that imply betting advice or guaranteed outcomes), fall back to a plain templated sentence built from the decoded data. Never send unreviewed model text to a user during a live match.

The explainer is the product. Spend your quality budget here.

### 2. The predict game (Hi-Lo, un-gameable)

The game: before the next stat update for a live match, the user guesses whether a chosen stat (default: total corners) will be **higher** or the **same/lower** than now. Correct guesses build a streak. Points only. No money, ever.

This is where the anti-manipulation work lives. There are three distinct attacks and each needs its own fix. Do not conflate them.

#### Attack 1 — timing (the important one)

The threat: a user submits or edits a guess *after* the real stat is already known, by watching a faster data source or by exploiting a client-side timer your server trusts.

The fix — **the server owns the clock and the sequence, never the client:**

- A "round" for a fixture is defined by the feed's own sequence number, not by wall-clock time. When the feed emits score `seq = N` for a fixture, the engine opens round `N→N+1`: guesses are now accepted for "what happens by the next update."
- The moment the feed emits `seq = N+1`, the engine **closes** round `N→N+1` server-side, atomically, *before* it processes or broadcasts the new value. Any guess for that round that has not already been committed is rejected.
- Every guess is stamped, server-side, with the sequence number it was committed against and the server receive time. The client's claimed time is ignored entirely. A guess row without a valid open round is invalid by construction.
- Concretely: `store.openRound(fixtureId, seq)`, `store.commitGuess(userId, fixtureId, roundSeq, direction)` which rejects if the round for `roundSeq` is not open, and `store.settleRound(fixtureId, seq, actualValue)` which scores every committed guess and closes the round in one transaction.

Because the round key is the feed's sequence number, there is no clock to race and no timer to fake. The user cannot commit a guess to a round that the server has already closed, and the server closes it before anyone sees the answer. This is the commit-then-reveal pattern reduced to its cheapest honest form.

#### Attack 2 — multiple accounts (sybil)

The threat: one person spins up many Telegram accounts (or the game keys off something spoofable) to farm streaks or flood a leaderboard.

The fix, proportionate to a hackathon:

- Key each player on their Telegram user ID, which is not trivially spoofable through the Bot API.
- Rate-limit guesses per user per round to exactly one.
- A leaderboard, if you build one, is cosmetic and points-only, so the incentive to sybil is low. Do not over-engineer this. Note in the write-up that wallet-based uniqueness (tie one player to one Solana address) is the production hardening path, but do not spend build time on it unless the core loop is already done.

#### Attack 3 — feed integrity

The threat: the underlying numbers are wrong.

The honest fix: **you do not own TxLINE's data and should not pretend to.** What you own is not introducing your own staleness. So: dedupe on `seq`, never show a value without its `seq` and `ts`, and if the newest event you hold is older than a freshness threshold, tell the user the feed is quiet rather than presenting stale data as live. TxLINE's own on-chain proofs exist if you ever need to demonstrate a value is authentic; you do not need to implement proof validation for the MVP, but mention it exists in the write-up as the trust story.

### A note on over-engineering the game

For a demo judged on a five-minute video, the sequence-locked round design above is enough and is also just correct. You do **not** need an on-chain commit-reveal scheme, cryptographic timestamping, or zero-knowledge anything. The judges will test whether it works and feels fair, not whether it survives a determined adversary. Build the server lock properly because it is cheap and right; stop there.

## The store (SQLite)

Tables for the MVP:

- `users` — telegram_id, first_seen, chosen_stat, notify_prefs.
- `rounds` — fixture_id, open_seq, status (open/closed), actual_value, opened_at, settled_at.
- `guesses` — user_id, fixture_id, round_seq, direction, committed_at, result.
- `streaks` — user_id, current, best.
- `seen_events` — fixture_id, seq — the dedupe ledger so a reconnect that replays events does not double-fire messages or double-open rounds.

Use `better-sqlite3` (synchronous, simple, fast enough by orders of magnitude for this). Wrap round settlement in a transaction so opening, scoring, and closing cannot half-happen.

## What to build this phase

1. `store/db.ts` + schema + typed accessors for the tables above.
2. `engine/significance.ts` — deterministic "is this worth a message" filter.
3. `engine/explainer.ts` — the LLM call, the constrained system prompt, output validation, templated fallback.
4. `engine/game.ts` — open/commit/settle round logic keyed on `seq`.
5. `engine/index.ts` — subscribes to `FeedEvent`s, routes them to explainer and game, emits `OutboundMessage`s.

Test the game logic with a scripted sequence of fake `FeedEvent`s (this is the one place mocking is correct — unit-testing the lock, not shipping mocked data). Prove that a guess committed to a closed round is rejected, and that settlement scores correctly.

Commit, then open `04-bot-setup.md`.
