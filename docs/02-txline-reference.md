# 02 — TxLINE Reference and Data Layer

Goal of this phase: authenticate against TxLINE on the free World Cup tier, then pull live fixtures, odds, and scores into the app. By the end you have a `feed/` module that emits typed events the rest of the app can consume.

Everything below is taken from the live TxLINE docs. Where a field name or endpoint appears here, it is real. If you need something not listed here, fetch the live doc and confirm before using it — do not guess field names.

Docs index: `https://txline-docs.txodds.com/llms.txt`
OpenAPI source: `https://txline.txodds.com/docs/docs.yaml` — fetch this to confirm exact response shapes before parsing.

---

## The mental model

TxLINE is a hybrid system. Data lives off-chain at TxODDS, but access is gated by an on-chain Solana subscription. To read a single number you must first:

1. Subscribe on-chain (a Solana transaction). For the World Cup free tier this costs no money, only devnet SOL for the transaction fee.
2. Activate an API token by signing a message with the same wallet.
3. Send **two** credentials on every data request.

This is why "sign up through Solana" is in the hackathon rules. It is not optional flavour; it is how the feed works. And because we use the **free World Cup tier on devnet**, the wallet only ever needs a free devnet airdrop.

## Network config (use devnet consistently)

Every piece — RPC, program ID, token mint, guest-auth host, API host — must be on the same network. Mixing them fails activation.

| | Devnet (use this) |
|---|---|
| RPC | `https://api.devnet.solana.com` |
| Program ID | `6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J` |
| TxL Token Mint | `4Zao8ocPhmMgq7PdsYWyxvqySMGx7xb9cMftPMkEokRG` |
| Guest auth | `https://txline-dev.txodds.com/auth/guest/start` |
| API base | `https://txline-dev.txodds.com/api/` |

You will need the matching **devnet IDL and types** for the Anchor program. Get them from `https://txline.txodds.com/documentation/programs/devnet`. Do not use the mainnet IDL on devnet.

## Free tier service levels

- **Service Level 1** — World Cup and International Friendlies, 60-second delayed. Documented on devnet.
- **Service Level 12** — real-time, but documented on mainnet.

For the build, **Service Level 1 on devnet** is the safe path: free, no KYC, no real money. The 60-second delay is fine for the demo — just never claim "zero latency" in the pitch. When you frame the product, say the analysis streams as the feed updates. That is true and it is enough.

If you later decide the demo genuinely needs real-time, that is a mainnet + service level 12 decision and it still requires no TxL payment for World Cup data — but it changes hosts and wallet funding. Do not switch without re-reading the worldcup doc.

---

## The one-time activation flow (do this once, at setup)

This runs from a small script, not from the request path. Run it once, capture the resulting API token, and the service reuses it.

### Step 1 — subscribe on-chain

Load the devnet IDL, derive the shared PDAs, and call `subscribe`. Free tier means `SERVICE_LEVEL_ID = 1`, `SELECTED_LEAGUES = []` (empty = standard bundle), `DURATION_WEEKS = 4`.

The wallet must have devnet SOL first. Airdrop it:

```bash
solana airdrop 2 <YOUR_WALLET_PUBKEY> --url https://api.devnet.solana.com
```

PDAs to derive (from the docs, verbatim seeds):

```typescript
const [tokenTreasuryPda] = PublicKey.findProgramAddressSync(
  [Buffer.from("token_treasury_v2")], program.programId);

const [pricingMatrixPda] = PublicKey.findProgramAddressSync(
  [Buffer.from("pricing_matrix")], program.programId);
```

The `subscribe` call and its full account list are in the worldcup doc. Copy the account structure exactly — a wrong account ordering fails on-chain.

### Step 2 — activate the API token

```typescript
// 1. guest JWT
const authResponse = await axios.post(`${apiOrigin}/auth/guest/start`);
const jwt = authResponse.data.token;

// 2. sign the activation message. For SELECTED_LEAGUES = [] the message is `${txSig}::${jwt}`
const messageString = `${txSig}:${SELECTED_LEAGUES.join(",")}:${jwt}`;
const message = new TextEncoder().encode(messageString);
const signatureBytes = /* sign with the SAME wallet that subscribed */;
const walletSignature = Buffer.from(signatureBytes).toString("base64");

// 3. activate
const activation = await axios.post(`${apiBaseUrl}/token/activate`,
  { txSig, walletSignature, leagues: SELECTED_LEAGUES },
  { headers: { Authorization: `Bearer ${jwt}` } });

const apiToken = activation.data.token || activation.data;
```

The signing wallet **must** be the same one that submitted `subscribe`, and the `jwt` must be from the same network host used to activate. A `403` on activation almost always means a mismatch in one of: signed message, wallet, signature encoding, network, or host.

### Credentials on every data request thereafter

| Header | Value |
|---|---|
| `Authorization` | `Bearer ${jwt}` from `/auth/guest/start` |
| `X-Api-Token` | `apiToken` from `/api/token/activate` |

The **JWT expires and the API token does not.** If a data request returns `401`, renew the guest JWT from `/auth/guest/start` and retry with the same API token. Build this retry into the feed client from the start — the JWT will expire mid-match otherwise, and you will lose the feed at the worst moment. Renew proactively (e.g. every N minutes) rather than only on 401.

---

## Endpoints you will actually use

### Fixtures snapshot — what matches exist

```
GET /api/fixtures/snapshot                      # all fixtures
GET /api/fixtures/snapshot?competitionId=<id>   # one competition
```

Fields used: `FixtureId`, `Participant1`, `Participant2`, `Participant1IsHome`, `StartTime`.

**Neutral-venue note that matters for the World Cup:** `Participant1IsHome` is the feed's home/away *designation for mapping*, not a venue guarantee. World Cup matches are at neutral sites, so `Participant1IsHome: true` just means Participant1 is listed first for feed purposes. Do not render it as "playing at home." Map it to home/away slots for display, nothing more.

You need the World Cup `competitionId` to filter. Confirm it against `https://txline.txodds.com/documentation/scores/schedule` before hardcoding. Do not assume a value.

### Scores — the state of a match

```
GET  /api/scores/snapshot/<fixtureId>     # current state
GET  /api/scores/updates/<fixtureId>      # live updates for a fixture
GET  /api/scores/historical/<fixtureId>   # full sequence (fixtures started 6h–2wk ago)
GET  /api/scores/stream                   # SSE: live scores across the feed
```

Score update fields seen in the docs: `seq` (sequence number), `ts` (timestamp), `gameState`. **Always keep `seq` and `ts`** with any value you store or show — they are your proof and your dedupe key. The historical endpoint only covers matches that started between 6 hours and 2 weeks ago; good for testing between live matches.

### Odds — what the market thinks

```
GET /api/odds/snapshot/<fixtureId>        # current odds
GET /api/odds/updates/<epochDay>/<hour>/<interval>
GET /api/odds/stream                      # SSE: live odds
```

TxLINE odds are "StablePrice." Read `https://txline.txodds.com/documentation/odds/overview` before you render or reason about odds, so the explanation layer describes them correctly rather than treating them like raw bookmaker prices.

### Streaming (SSE) — the heart of the live product

Both `/api/odds/stream` and `/api/scores/stream` are Server-Sent Events. Headers:

```typescript
{
  Authorization: `Bearer ${jwt}`,
  "X-Api-Token": apiToken,
  Accept: "text/event-stream",
  "Cache-Control": "no-cache",
}
```

The docs provide a full SSE parsing helper (`readSseMessages`, `parseSseBlock`, `parseSseData`). **Use their helper verbatim** — do not write your own SSE parser, it is a waste of your limited time and theirs is correct. Fetch it from `https://txline.txodds.com/documentation/examples/streaming-data`.

Add `Accept-Encoding: gzip` to cut bandwidth ~70–80%, but only if you also decompress with `gunzipSync` from `zlib`. For the MVP, skip gzip unless bandwidth is a real problem — one less thing to break.

**SSE reconnection is mandatory.** Long-lived connections drop. Wrap the stream in a reconnect loop with backoff, and on reconnect, renew the JWT. A dropped stream that never reconnects means a dead demo. This is the single most important reliability detail in the whole data layer.

---

## Soccer stat encoding — this is what makes the game concrete

Scores carry stats encoded as `(period * 1000) + base_key`. Full-game base keys:

| Key | Statistic |
|---|---|
| 1 | Participant 1 total goals |
| 2 | Participant 2 total goals |
| 3 | Participant 1 total yellow cards |
| 4 | Participant 2 total yellow cards |
| 5 | Participant 1 total red cards |
| 6 | Participant 2 total red cards |
| 7 | Participant 1 total corners |
| 8 | Participant 2 total corners |

Period multipliers: First half +1000, Second half +2000, ET1 +3000, ET2 +4000, Penalties +5000. So key `1001` is Participant 1 first-half goals.

Game-phase encoding (subset you care about): `1` not started, `2` first half, `3` halftime, `4` second half, `5` ended, `12` penalty shootout in progress, `13` ended after penalties. Use these to know whether a match is live and predictable, or over.

**For the Hi-Lo predict game, corners (keys 7, 8) are the best stat to use:** they change often enough to keep the game moving, they are unambiguous, and they carry less emotional weight than goals so a wrong guess does not feel unfair. Goals (1, 2) are too rare for a fast game. Cards are fine as a secondary axis.

---

## What to build this phase

1. `feed/auth.ts` — the one-time activation script (subscribe + activate), plus a runtime `getJwt()` that caches and auto-renews the guest JWT.
2. `feed/client.ts` — an authenticated HTTP client (axios instance) with both headers and a 401-renew interceptor.
3. `feed/streams.ts` — the SSE consumers for scores and odds, using TxLINE's parser helper, wrapped in a reconnect-with-backoff loop.
4. `feed/types.ts` — zod schemas for fixture, score update, and odds update. Parse every payload through these. If a payload fails the schema, log it and skip it rather than crashing.
5. `feed/decode.ts` — turn encoded stat keys into human labels (`7 -> "corners (home)"`), and decode game phase.

Emit a single internal event type, e.g. `FeedEvent`, that the engine consumes. Something like:

```typescript
type FeedEvent =
  | { kind: "score"; fixtureId: number; seq: number; ts: number; phase: GamePhase; stats: DecodedStat[] }
  | { kind: "odds"; fixtureId: number; seq: number; ts: number; markets: DecodedOdds };
```

Keep the feed layer dumb: it authenticates, parses, decodes, dedupes on `seq`, and emits. It does not explain, does not talk to Telegram, does not touch the game. Separation here is what lets you test the feed on its own before wiring anything else.

## Test it before moving on

Between live matches, use `/api/scores/historical/<fixtureId>` on a recently-finished match to replay a real sequence through your decode layer and confirm you get sensible labels and phases. When a live match is on, confirm the SSE stream emits and your reconnect loop survives a forced disconnect (kill your wifi for ten seconds).

Commit, then open `03-architecture.md`.
