# TxLINE API — builder feedback

Honest, specific notes from actually building on the free World Cup tier (devnet, Service Level 1).

## What worked well

- **The SSE parser helper is genuinely good.** Shipping a correct `readSseMessages` / `parseSseBlock` in the docs saved real time and removed a whole class of bugs — writing our own SSE parser would have been wasted effort on both sides. We used it verbatim.
- **The OpenAPI YAML is the source of truth and it's complete.** When the prose docs were thin on exact response shapes, `docs.yaml` had the precise field names and types (`Scores`, `OddsPayload`, `Fixture`), which let us write strict zod schemas with confidence instead of guessing.
- **Free World Cup data on devnet with no KYC and no real money** is exactly the right on-ramp for a hackathon. The airdrop-and-subscribe path is frictionless once you're on the right network.

## Where we hit friction

- **The two-credential auth is a real gotcha.** The guest JWT expires but the API token does not, and nothing in the immediate flow makes that split obvious. We only got a stable feed once we built proactive JWT renewal plus a 401-retry that renews the JWT and keeps the same API token. A one-liner in the auth docs — "the JWT expires, the API token doesn't; renew the JWT, reuse the token" — would save builders an afternoon.
- **The on-chain subscribe is a prerequisite even for free data**, and the failure modes are opaque. A 403 on activation can mean any of: wrong signed message, wrong wallet, wrong signature encoding, wrong network, or wrong host. A checklist of "these five things must all be on the same network" (which the worldcup doc hints at) surfaced earlier would help — mixing a mainnet JWT host with a devnet subscribe is an easy and silent mistake.
- **`Participant1IsHome` at a neutral venue is a trap.** For the World Cup every match is at a neutral site, so the flag is a home/away *slot mapping*, not a venue fact. It would be easy to render "playing at home" and be wrong. The note exists in the schedule docs but deserves to be louder for anyone doing a World Cup build.
- **`gameState` is typed as a string** in the spec while the soccer-feed prose describes numeric phase codes. We handled both defensively (numeric-string and status-code maps), but a documented enum of the exact `gameState` string values would remove the guesswork.
- **The stat period-multiplier table isn't consistent between pages.** The soccer-feed page and other references list different period prefixes (e.g. second half as +2000 vs +3000). The base keys (1–8) are consistent everywhere, so our game — which only needs total corners — was unaffected, but anyone decoding half-specific stats will trip on this. One canonical table would fix it.
- **The 60-second free-tier delay** is fine for a fan product, but it's worth stating plainly up front so builders don't design around real-time and then have to walk it back.

Net: the hard parts were all in auth and on-chain setup, and all discoverable — but a short "gotchas" page (JWT-vs-token, same-network checklist, neutral-venue flag, gameState enum, canonical stat table) would take this from a two-afternoon integration to a two-hour one.
