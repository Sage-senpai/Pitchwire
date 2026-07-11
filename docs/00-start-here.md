# 00 — Start Here

You are Claude Code, working on Pitchwire. You have read `CLAUDE.md`. This file orients you to the whole build and the order of work. Read it once, then begin Phase 01.

## The situation, plainly

There are a fixed number of days left before the July 19 deadline, and the deadline is hard because the World Cup itself ends that day. The live data the whole product depends on stops existing when the tournament stops. So the real deadline for a working, demo-able product is a day or two before the last match you can film, not the submission cutoff.

That single fact drives every scoping decision. When in doubt, cut. A smaller thing that works and films well beats a bigger thing that half-works.

## The build in seven phases

Each phase is a doc in this folder. Do them in order. Do not start a phase until the previous one runs.

| Phase | File | What you end up with |
|---|---|---|
| 01 | `01-foundations.md` | Repo scaffolded, env wired, TypeScript building, a hello-world bot that replies. |
| 02 | `02-txline-reference.md` | The data layer: authenticated against TxLINE, pulling live World Cup fixtures, odds, and scores. This is reference + implementation. |
| 03 | `03-architecture.md` | The system design: how data flows from feed to explanation to chat, and how the predict game is made un-gameable. |
| 04 | `04-bot-setup.md` | The Telegram bot proper: commands, inline buttons, message formatting, BotFather setup. |
| 05 | `05-design.md` | The identity: how it looks in chat, how it talks, what makes it not-generic. |
| 06 | `06-skills-routing.md` | Which of your available skills to reach for at each kind of task. |
| 07 | `07-demo-and-submit.md` | The submission checklist: demo script, technical write-up, feedback form, what judges test. |

## What "good" looks like at each layer

- **Data layer:** never guesses, never mocks in the final build, always logs the TxLINE sequence number and timestamp alongside any value it shows. If the feed is stale it says so rather than showing an old number as if it were live.
- **Explanation layer:** turns a raw stat change into one or two sentences a non-technical fan understands, grounded only in what the feed actually said. It does not speculate beyond the data. It never advises a bet.
- **Game layer:** the guess window opens and closes on the server against the feed's own sequence, so there is no client-side clock to cheat.
- **Chat layer:** feels designed, not defaulted. Consistent voice, tight formatting, buttons that do what they say.

## A standing instruction on scope creep

You will receive, or generate, many good ideas mid-build. An opportunity graph. A Mini App. Personalization. Multi-user proactive push. Historical trend charts. Each is genuinely good and each is a trap on this timeline. The discipline that ships a hackathon project is subtraction. Log good ideas in `docs/NOTES.md` as "post-submission" and keep moving. Do not build them into the critical path.

Now open `01-foundations.md`.
