# Demo script — Pitchwire (target ~3 minutes)

Record during a live match, with margin — a quarterfinal or semifinal, not the final with zero fallback. Quiet screen, no notification banners, readable font size, clean captions or audio.

## Beat 1 — the problem (20s)
Hold up a phone mid-match. "You're watching the game on your phone. You've got a scoreboard. The odds just moved and nothing tells you why." Show a plain odds screen for contrast.

## Beat 2 — the product, one line (15s)
"Pitchwire is the live wire. It reads the match and the market and tells you what just changed." Open the bot, send `/start`. The dateline read-out style is on screen immediately.

## Beat 3 — the live moment (60–90s) — the shot that wins it
A real event in the live match: a goal, a card, or a genuine odds swing. Show the read-out arriving in chat:

```
ARLINGTON · 78' · SEQ 4471
━━━━━━━━━━━━━━━━
Red card, Morocco. The market's already swung to France.
```

Point at the `SEQ` and the timestamp: "That's the feed's own sequence number and time, on every message — so you can see it's live, not a replay." Let the moment breathe; this is the core.

## Beat 4 — the game (30s)
`/guess`. Show the current corners, tap **Higher**. Narrate the fairness while the next update lands: "The guess locks against the feed's own sequence, server-side — there's no clock to race and no way to guess after the fact." Show it settle and the streak tick.

## Beat 5 — how TxLINE powers it (20s)
Briefly show the seq/ts telemetry and name the endpoints: "Live TxLINE World Cup data over Server-Sent Events — scores stream, odds stream, gated by a one-time Solana devnet subscription." One line, credible.

## Beat 6 — close (10s)
"A fan-engagement layer that reads the match and the market — it explains, it never tells you to bet." Show the deployed link and the bot handle.

## What NOT to do
- Don't claim token-by-token streaming — Telegram has none. Say "the read-out arrives on the wire and resolves in place" (placeholder → single edit). True and enough.
- Don't claim zero latency — the free tier is 60s delayed. Say "streams as the feed updates."
- Don't call it a betting bot, ever.
