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

## Open questions to resolve early (don't guess)
- World Cup `competitionId` for the fixtures filter — confirm against the schedule doc before hardcoding.
- Exact odds payload shape from `/api/odds/stream` — confirm against the OpenAPI YAML before writing the odds decoder.
- Whether devnet free tier is actually serving live World Cup data during your target match, or whether real-time needs mainnet SL12 — test this on the first available live window, not on demo day.
