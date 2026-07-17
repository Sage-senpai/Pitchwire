# Pitchwire — demo voiceover script

~2.5 min at a natural pace. Voice: Chris (ElevenLabs premade, "Charming, Down-to-Earth").
Tone: builder showing a friend something that works. Hook first. No em dashes. Concrete.

Segmented so each clip aligns to its matching footage. Files render to `demo/vo/`.

---

## 01 — hook / problem  (~18s)
You are watching the World Cup on your phone. You have a scoreboard, not a read. The odds move, and nobody tells you why. That gap is the whole reason I built Pitchwire.

## 02 — what it is  (~14s)
Pitchwire is a Telegram bot that reads the match and the market, and sends you one clear line the moment something changes. It explains. It never tells you to bet.

## 03 — the live moment  (~40s)
Here it is reading a real World Cup match, Mexico against England, straight off the TxLINE live feed. Watch the wire. A goal lands, and Pitchwire calls it in plain language. Then a red card. England down to ten men, still ahead. Every read-out opens like an old telegraph dateline: the venue, the minute, and the feed's own sequence number. That number is not decoration. It is proof the read is live and in order.

## 04 — the game  (~32s)
There is also a game. Before the next stat, you call it higher or the same. Get it right, your streak climbs. Here it hits three in a row. And the fair part: your guess locks against the feed's own sequence number, on the server, before the next update is revealed. There is no clock to race and no timer to fake. You cannot guess after the fact.

## 05 — how it runs  (~22s)
All of this is live TxLINE World Cup data over server-sent events. On-chain subscription on Solana devnet to unlock the feed, guest auth, then the scores and odds streams. The sequence and timestamp you see on every card come straight from that feed.

## 06 — close  (~14s)
Pitchwire reads and explains. It holds no funds and places no bets. That line is deliberate. It is live on Telegram right now. Link is on screen. Get on the wire.
