# NOTES — parking lot

Good ideas that are NOT on the critical path. Park them here so they stop competing for build time. Revisit only after the Phase 07 checklist is green.

## Post-submission ideas (deliberately deferred)
- Telegram Mini App as a second surface for richer views (the chat-vs-app split). Good pattern, whole extra frontend, not for this timeline.
- Proactive push to many users when a high-signal moment hits across any live match (the "opportunity engine" idea). Simpler single-user version is in scope; the fan-out is not.
- Personalization / "learns your taste" recommendation loop. Real ML feedback, out of scope.
- Historical odds-movement charts.
- Wallet-based one-player-one-identity sybil hardening (tie Telegram user to a Solana address). Note it in the write-up as the production path; do not build it unless the core loop is done early.
- On-chain proof validation of TxLINE values. Mention it exists as the trust story; do not implement for MVP.
- gzip on the SSE streams. Only if bandwidth becomes a real problem.

## Decisions log (so we don't relitigate)
- Read-and-explain product, not custody/execution. Locked. See CLAUDE.md boundaries.
- Devnet + free tier service level 1. Locked unless real-time is proven necessary.
- Corners (stat keys 7/8) as the default game stat. Locked; cards secondary.
- grammy for the bot. Locked.
- SQLite for the MVP store. Locked; no Postgres.

## Open questions — RESOLVED against live devnet (2026-07-16)
- World Cup `competitionId` = **72**. Confirmed live: the fixtures snapshot returns `72 · World Cup`. We still match on the `Competition` name at runtime and log the id, so this is a verified default, not a blind hardcode.
- Odds payload shape — decoder written against the OpenAPI `OddsPayload` schema (aligned `PriceNames`/`Prices`/`Pct`, `Pct` = demargined StablePrice). Still worth eyeballing live odds values render sensibly during a match.
- Devnet free tier **is** serving live World Cup data. Snapshot returned 3 WC fixtures (England v Argentina, Spain v Argentina, France v England). No need for mainnet SL12.

## Real payload format (learned by replaying a live match, 2026-07-16)
- The REST **score snapshot** (`/api/scores/snapshot/<id>`) returns the FULL array of
  events (not just the latest), and serializes **PascalCase**: `Seq`, `Ts`, `Stats`,
  `StatusId`, plus a nested `Score` object. Its `GameState` string is unreliable (reads
  `"scheduled"` even at 90'), so `StatusId` is the real phase signal (1 pre, 3 HT, 4 in
  play, 5/100 finished). The SSE stream uses camelCase (`seq`/`ts`/`stats`/`gameState`).
  `ScoreUpdateSchema` now normalizes BOTH casings so the live bot survives either.
- The `Stats` map matches our decoder exactly: base keys 1-8 + period prefixes
  (1000 1H, 3000 2H, ...). Verified: H1 corners 1 + H2 corners 5 = Total corners 6.
- `/scores/updates` and `/scores/historical` were EMPTY for a just-concluded match;
  the snapshot array is what carries the timeline until it ages into /historical.
  `replay.ts` falls back to `getScoreSequence` (snapshot) when /historical is empty.
- Proven end-to-end: replayed real fixture #18241006 (England 1-2 Argentina) through
  decode -> significance -> explain -> game. `npm run replay -- 18241006 England Argentina`.

## Activation gotcha (learned the hard way)
- The `subscribe` instruction expects the wallet's TxL **associated token account to already exist** — it is not `init`ed on-chain. Without it you get `AccountNotInitialized (3012)` on `user_token_account`. Fix (now in `feed/activate.ts`): create the TOKEN_2022 ATA idempotently before subscribing. Free tier balance is 0, so an empty ATA is fine.
- Live service wallet (devnet, throwaway): `7qwHC1Vn2ooewUDBvKN6cPyEukpQmQ59HHqhsDtJ2hxV`. Subscribed successfully; API token is in `.env` (non-expiring).
