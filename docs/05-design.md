# 05 — Design and Identity

Goal of this phase: give Pitchwire a look and a voice that could not be mistaken for a generic AI project. This is a chat bot, so most of the "design" is language, formatting rhythm, and one recognisable mark — plus any real UI surfaces (a status card image, the bot avatar, a landing page for the submission link).

Read this before writing any user-facing string, avatar, or page. The default AI aesthetic is banned here on purpose.

## The concept

A pitchwire was the telegraph line that carried match results back from the ground before radio existed. Short, urgent bursts down a wire: a goal, a card, the final score, tapped out and sent. That is the whole identity. Pitchwire is that wire, brought back, now fast enough to keep up with the live market.

Everything flows from that: the terseness, the sense of a signal arriving, the slightly old-world telegraph vocabulary sitting on top of very modern data. It is a **telegraph operator who reads betting markets**, not a chatbot with a football skin.

## What we are NOT doing

Explicitly banned, because these are what every AI hackathon project defaults to and the brief is that it must stand out:

- **No purple/indigo gradient.** None. Not on the avatar, not on the landing page, not anywhere.
- No generic "AI assistant" blue.
- No glassmorphism, no floating 3D blobs, no neon-on-black "cyber" look.
- No emoji-per-line. No 🚀, no 🔥 as decoration.
- No hero section that is a big number with a small label and a gradient accent.
- No sparkles/wand iconography implying "magic AI."

If a choice would look the same on any other AI project, it is the wrong choice. Spend the boldness on the telegraph concept instead.

## Palette — "signal room"

A telegraph office at night. Warm paper, dark ink, and the single amber of a live wire.

- `--ink` `#14110E` — near-black brown-black, primary text and dark surfaces. Not pure black; ink on paper was never pure black.
- `--paper` `#EDE6D6` — warm aged-paper cream, primary light background.
- `--wire` `#C6532A` — burnt amber-orange, the live signal. The one accent. Used sparingly: the live dot, the one bolded movement, the active button. This is the deliberate risk — a single warm signal colour doing all the emphasis.
- `--brass` `#9A7B4F` — muted brass, for secondary marks, dividers, the operator's furniture.
- `--verdigris` `#3F5E54` — aged-copper green, a cool counterweight used only for "settled / correct / confirmed" states so success never rides on the amber.
- `--faded` `#8A8375` — low-contrast greige for timestamps, sequence numbers, the quiet metadata.

Note this is deliberately *not* the AI-default warm-cream-plus-terracotta look, even though it is warm: the accent is a burnt signal-amber, not clay terracotta, the second accent is verdigris not black, and the whole thing is anchored in the telegraph concept rather than being cream-because-cream-looks-nice. If it starts drifting toward generic warm-minimal, pull it back to the signal-room idea.

## Type

- **Display / wordmark:** a slab serif or a mono with real character (something like *Space Mono*, *JetBrains Mono*, or a slab like *Roboto Slab*). The mono reads as "wire copy / teletype," which is exactly the concept. Use it for the wordmark and for the one-line match headers.
- **Body (chat is Telegram's own font, so this is for the card image and landing page):** a clean readable sans for anything longer than a headline.
- **Data / metadata:** the mono again, small, in `--faded`, for sequence numbers and timestamps. Showing `seq` and `ts` is both an honesty feature and an aesthetic one here — it looks like wire telemetry.

## The signature element

**The wire dateline.** Old telegraph messages opened with a dateline: place, time, then the message. Every significant Pitchwire read-out opens the same way — a compact monospace dateline, then the message. Example shape (not literal copy):

```
ARLINGTON · 78' · SEQ 4471
━━━━━━━━━━━━━━━━━━━━
Red card, Morocco. Market's
already swung to France.
```

That dateline-then-signal rhythm is the thing a judge remembers. It encodes real information (venue, match minute, feed sequence), so it is structure carrying meaning, not decoration. It is also unmistakably Pitchwire.

## Voice

Pitchwire talks like a telegraph operator who happens to read markets: **clipped, certain, never padded.** It reports the signal and what it means, then stops.

Rules:

- Short declaratives. "Goal, Norway. That's the market's number now." not "It appears that Norway has scored, which the market seems to be reacting to."
- Present tense, active voice. The wire reports what *is*.
- Confident, never hedged into mush, but never hyped. No "HUGE." No "massive value." No exclamation stacks.
- It explains, it never advises. "The market moved to France" is allowed. "Back France" is not. This is the boundary from `CLAUDE.md` expressed as tone.
- Never apologises for itself, never pads, never asks the user to keep chatting.
- The occasional telegraph tic is on-brand and charming in small doses — a message can *end* the way a telegram did, but do not overdo it. One flourish per session, not per message.

Failure and empty states stay in voice: "Wire's quiet. No live match to read." not "Sorry, there is currently no data available at this time."

## Surfaces to actually build

1. **Bot avatar / wordmark.** A single mark: a telegraph key, a wire, or the word set in the mono display face on `--ink` with a `--wire` live dot. Flat, two colours, legible at 32px. No gradient. Use the `frontend-design` skill's thinking, and if generating the image, keep it to the palette above.

2. **A live "wire card" image (optional but high-value for the demo).** When a big moment hits, the bot can send a generated card image — the dateline, the signal line, the seq/ts telemetry — styled as above. This is the single most screenshot-able, most demo-friendly artifact in the whole project. If you build one visual thing beyond the avatar, build this. Render it as an SVG or an HTML-to-image so the type and palette are exact.

3. **A one-page landing site for the submission link.** Judges click a deployed link; give them a page that is unmistakably designed. Hero is the wire concept — not a big-number-plus-gradient. Use the `frontend-design` skill and the `theme-factory` skill approach: derive every colour and type choice from the tokens above, take the telegraph risk, keep everything else quiet. One page, fast, responsive to mobile, real copy in Pitchwire's voice. This page is also where the demo video embeds.

## Self-check before you ship any surface

- Would this look identical on a random other AI hackathon project? If yes, redo it.
- Is there a gradient? Remove it.
- Is the amber doing all the emphasis, with everything else quiet? Good. If three colours are shouting, cut two.
- Does the copy sell, or does it report? It should report.
- Does the dateline carry real information? It must.

Commit, then open `06-skills-routing.md`.
