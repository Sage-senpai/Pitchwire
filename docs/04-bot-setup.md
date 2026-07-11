# 04 — Bot Setup

Goal of this phase: the Telegram bot proper. Commands, inline buttons, the streaming-message pattern, and a BotFather profile that looks like a real product for the demo. By the end, the full loop is visible in chat.

## Why grammy

Telegram has a few Node frameworks. Use `grammy`: it is typed, current, has clean middleware and inline-keyboard handling, and its docs are good. Do not use raw HTTP against the Bot API — you will reinvent update handling badly. Do not use an abandoned framework; a dead dependency during a hackathon is a self-inflicted wound.

## BotFather setup (do this properly — it shows in the demo)

Message `@BotFather` and set all of these. A polished bot profile is nearly free and it reads as "real product" to a judge:

- `/setname` — Pitchwire
- `/setdescription` — the short pitch a user sees before starting. One or two lines in Pitchwire's voice. Example: "The live World Cup wire. I read the match and the market and tell you what just changed." No betting-advice language.
- `/setabouttext` — the even shorter about line.
- `/setuserpic` — a real icon. See `05-design.md` for the mark; generate it and upload it. A default blank avatar screams unfinished.
- `/setcommands` — register the command list so they autocomplete:

```
start - Get on the wire
watch - Follow a live match
guess - Play the next-stat game
streak - See your run
matches - What's live right now
stop - Leave the wire
```

## The message pattern for streamed explanations

Telegram has **no native token-by-token LLM streaming primitive.** There is no `sendRichMessageDraft`. Do not claim otherwise to judges — some of them know the Bot API and it undercuts your credibility.

What actually exists, and what you use:

- `sendMessage` to post.
- `editMessageText` to update a message in place.

So the honest "streaming" pattern is: post a short placeholder ("Reading the play…"), then edit that message once with the finished explanation, or edit it a small number of times as the explanation builds. **Respect the edit rate limit** — roughly one edit per second per message is safe; hammering edits gets you rate-limited and looks worse than a single clean update. For a one-or-two-sentence explanation, a placeholder followed by a single edit is the right call: it feels alive without fighting the platform.

When you describe this in the write-up, say it accurately: "analysis is streamed by incrementally editing the chat message as the read-out is composed, while live data arrives over SSE." True and compelling.

## Commands and flows

### `/start`
Warm, short, in-voice. One line on what Pitchwire does, one tappable button to see live matches. Register the user in the store.

### `/matches`
Pull the fixtures snapshot, filter to World Cup fixtures that are live or starting soon, render as an inline keyboard — one button per match. Tapping a match follows it (`/watch` behaviour). Keep it to what is actually live; a wall of finished fixtures is noise.

### `/watch <match>`
Subscribe this user to significant events for that fixture. From now on, when the engine emits an explanation for that match, this user gets it. Confirm with a single clean message naming the match.

### `/guess`
Start the predict game for the match the user is watching. Show the current value of the chosen stat (default corners) and two buttons: **Higher** and **Same or lower**. The tap commits a guess to the current open round (see the sequence-lock in `03-architecture.md`). If no round is open (no live match, or between updates), say so plainly rather than accepting a dead guess.

### `/streak`
Show current and best streak. Cosmetic, points only.

### `/stop`
Unsubscribe from everything. Confirm. Do not guilt-trip or try to retain them.

## Formatting rules

- Use Telegram's HTML or MarkdownV2 parse mode consistently — pick one and stick to it. MarkdownV2 has escaping traps; if you hit them, HTML mode is more forgiving.
- **Bold the one thing that matters** in each message (the team, the stat, the movement), nothing else. Over-bolding reads as noise.
- Inline keyboards for anything the user chooses. Never make a user type a команда when a button will do — thumbs on a phone during a match want taps.
- Every message is short enough to read at a glance without scrolling. A fan is watching football, not reading a report.
- No emoji spam. One purposeful mark occasionally is fine (see design doc); a row of them is not.

## Reliability during the demo

- Wrap the bot in the same process as the feed, but isolate failures: an LLM error must not kill the feed, a feed hiccup must not crash the bot. Catch, log, degrade gracefully.
- If the LLM is slow or errors, send the templated fallback rather than nothing. A plain accurate sentence beats a spinner that never resolves.
- Log every outbound message with the `seq` it was triggered by, so if something looks wrong mid-demo you can trace it.

## What to build this phase

1. `bot/index.ts` — the grammy bot, command registration, error boundary.
2. `bot/commands/` — one file per command.
3. `bot/render.ts` — formatting helpers so voice and formatting are consistent in one place, not scattered.
4. Wire `OutboundMessage` from the engine to the right subscribed users.

Test the whole loop against a live match if one is on, or against a replayed historical sequence if not. Confirm: a significant event produces an explanation in chat, and the guess buttons commit and settle correctly.

Commit, then open `05-design.md`.
