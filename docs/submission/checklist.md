# Pre-submission checklist — status

Legend: ✅ done in code · 🔑 needs your credentials/live data · 🚀 needs deploy

| Item | Status | Notes |
|---|---|---|
| Core loop implemented end to end (event → explanation → chat) | ✅ | feed → engine → bot; proven offline with the templated fallback |
| Predict game commits & settles correctly; sequence lock enforced | ✅ | `npm run test:game` — 6 checks pass, incl. "commit to a closed round is rejected" |
| No custody / execution / market integration in shipped code | ✅ | grep clean; only on-chain surface is `feed/activate.ts` (our own devnet subscribe) |
| No betting-advice language in user-facing strings | ✅ | grep clean; enforced at runtime by the explainer banned-phrase guard |
| Never called a "betting bot" anywhere | ✅ | grep clean across `src/`, `docs/`, `web/`, README |
| TypeScript builds; strict mode | ✅ | `npm run build` → `dist/` clean |
| Landing page, avatar, wire-card designed (no gradient) | ✅ | `web/` — signal-room palette, mobile-responsive |
| Technical write-up | ✅ | `docs/submission/technical-writeup.md` |
| TxLINE feedback answered specifically | ✅ | `docs/submission/txline-feedback.md` |
| Demo script | ✅ | `docs/submission/demo-script.md` |
| Bot token in `.env` and `/start` replies in a real chat | 🔑 | BotFather → `TELEGRAM_BOT_TOKEN`; see `docs/04` |
| Anthropic key in `.env` | 🔑 | `ANTHROPIC_API_KEY`; explainer falls back to templates without it |
| TxLINE activated (subscribe on devnet + API token) | 🔑 | fund the service wallet, `npm run activate`, paste `TXLINE_API_TOKEN` |
| Verify **live** World Cup data flows on your target match | 🔑 | test on the first live window, not demo day (see `docs/NOTES.md` open questions) |
| Confirm the World Cup `competitionId` against live fixtures | 🔑 | code defaults to 72 and self-verifies by matching the `Competition` name — check the log line at boot |
| Bot deployed, running, funded, staying up through judging | 🚀 | single always-on Node process (Railway/Fly), not serverless |
| Landing page deployed; demo video embedded; bot handle updated | 🚀 | `web/index.html`; swap the `t.me/PitchwireBot` links |
| BotFather profile set (name, description, about, commands, avatar) | 🔑 | `docs/04`; commands auto-register at boot via `setMyCommands` |
| Demo video recorded during a live match, < 5 min | 🔑🚀 | record with margin — a QF/SF, not the final |
| Public repo public with a real README | ✅🚀 | README present; make the repo public before submitting |
| Submitted through Superteam Earn | 🚀 | the Solana requirement is satisfied by the on-chain subscribe + the platform |

## The one thing that can't wait
Live TxLINE World Cup data stops when the tournament ends (final: July 19). Get a recordable product running against a **live** match at the earliest window you can hit, and treat every match after as a retake — do not first-attempt on the final.
