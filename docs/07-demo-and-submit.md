# 07 — Demo and Submit

Goal of this phase: turn a working bot into a winning submission. The hackathon is judged mainly on the five-minute demo video, and the matches end when the tournament ends, so this phase is not an afterthought — it is where a good build becomes a good submission or fails to.

## The hard timing fact, again

Your live-data windows are the remaining matches: quarterfinals, semifinals, third-place match, final. Once the final ends on July 19, there is no live TxLINE World Cup data to film. **Record your primary demo during a live match, with time to spare — not on the final with zero margin.** If your only clean take is the final and something breaks, you have no submission. Plan to have a recordable product by the earliest live window you can hit, and treat every match after that as a retake opportunity, not the first attempt.

## What the judges actually score

From the brief, in their words, judging weighs: fan accessibility and UX, real-time responsiveness, originality, a commercial/monetization path, and completeness. Map each to something the demo must show:

- **Fan accessibility & UX** → show a non-technical person opening the bot and immediately getting it. No jargon on screen. The dateline read-out is instantly legible.
- **Real-time responsiveness** → show the bot reacting to a real thing happening in a live match. This is the whole point; make it the centre of the video.
- **Originality** → the telegraph-wire framing and the read-the-market-plus-the-match angle. Say out loud why this is not just another odds feed.
- **Commercial path** → one honest sentence: this is a fan-engagement layer that could sit on top of any sportsbook or broadcaster as a retention product, or run as a premium wire. Not "we take a cut of bets" — that is the framing you are avoiding.
- **Completeness** → the loop works end to end on screen, including the game settling a guess correctly.

## The demo video (up to 5 minutes — use ~3)

Structure, tight:

1. **The problem, 20 seconds.** A fan watching on their phone has a scoreboard, not a read. Odds move and nobody explains why. Show the gap.
2. **The product, one line.** "Pitchwire is the live wire — it reads the match and the market and tells you what just changed." Show the bot's `/start`.
3. **The live moment, the core 60–90 seconds.** A real event in a live match. The dateline read-out arrives in chat. This is the shot that wins or loses it. If you captured a genuinely good live moment (a goal, a card, a real odds swing with a clean explanation), lead with it.
4. **The game, 30 seconds.** Show a guess committing, the next update arriving, the guess settling, the streak ticking. Narrate the fairness: "the guess locks against the feed's own sequence, server-side, so there's no way to guess after the fact." That line addresses a judge's unspoken "is this rigged" question.
5. **How TxLINE powers it, 20 seconds.** Show, briefly, that this is live TxLINE World Cup data over SSE — the seq/ts telemetry on screen makes this visible and credible. Name the endpoints.
6. **Close, 10 seconds.** The one-line commercial framing and the deployed link.

Record clean: no notification banners, a quiet screen, readable font size, real audio or clean captions. A judge watches many of these; clarity beats production polish.

## The deployed link

Judges need a working link OR a functional API endpoint to test. Give them the bot handle (`t.me/yourbot`) and the landing page. Make sure the bot is actually running and funded on devnet when you submit, and stays up through the judging window. A dead bot at judging time fails the completeness bar instantly. Consider a simple uptime check.

## The technical write-up (short — markdown, in Pitchwire's voice where it fits)

Cover, briefly:

- **Core idea** — one paragraph. The wire concept, the read-the-match-and-market angle.
- **Technical highlights** — the SSE live feed with reconnect + JWT renewal, the sequence-locked un-gameable guess mechanic, the constrained explanation layer with a templated fallback, the honest no-custody boundary as a deliberate design choice.
- **TxLINE endpoints used** — list the real ones: `/auth/guest/start`, `/api/token/activate`, `/api/fixtures/snapshot`, `/api/scores/snapshot`, `/api/scores/stream`, `/api/odds/stream`, and the soccer stat encoding. Be specific; it shows you actually used the API.
- **The trust story** — seq/ts on every value, dedupe on sequence, and TxLINE's on-chain proofs available as the authenticity backstop.

## The feedback answer (they explicitly ask, and it is easy points)

They ask what your experience with the TxLINE API was — what you liked, where you hit friction. Answer honestly and specifically. Real friction you can speak to from the build: the two-credential auth with a JWT that expires but an API token that does not (renewal logic needed), the on-chain subscribe step as a prerequisite even for free data, the neutral-venue `Participant1IsHome` gotcha, and the 60-second free-tier delay. Specific, honest feedback reads as a serious builder and is exactly what they said they want. Do not flatter; tell them what actually rubbed.

## Final pre-submission checklist

- [ ] Bot is deployed, running, and funded on devnet.
- [ ] Live TxLINE World Cup data is the input — verified, not mocked.
- [ ] The core loop works end to end in a real chat.
- [ ] The predict game commits and settles correctly, and the sequence lock is provably enforced.
- [ ] No custody, no execution, no market integration anywhere in the shipped code. (Grep the repo one last time.)
- [ ] No betting-advice language in any user-facing string. (Grep for the banned phrases.)
- [ ] Demo video recorded during a live match, under 5 minutes, clean.
- [ ] Landing page live, designed, mobile-responsive, no gradient.
- [ ] Public repo is public and has a real README.
- [ ] Technical write-up done.
- [ ] TxLINE feedback answered specifically.
- [ ] Submitted through Superteam Earn (the Solana sign-up requirement is satisfied by the on-chain subscribe + the platform).

Submit with time to spare. Do not submit at 23:58 UTC on July 19.
