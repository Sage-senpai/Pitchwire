# CLAUDE.md — Pitchwire

This file is the operating brief for Claude Code on this project. Read it fully before writing any code. When you start a work session, read this file, then read the file named in whichever `docs/` phase we are on. Do not skip ahead.

---

## What we are building

**Pitchwire** is a Telegram bot for the 2026 World Cup that turns the TxLINE live data feed into plain-language read-outs of what is happening in a match and what the market thinks about it. It also runs a small predict-the-next-stat game so a fan has a reason to keep the chat open.

It is a **read-and-explain** product. It does not hold anyone's money, place bets, or touch a prediction market. That boundary is deliberate and non-negotiable (see "Hard boundaries" below).

The name: a pitchwire is the old term for the telegraph line that carried match results back from the ground before radio. It fits. Use it consistently. Never call this a "betting bot" in code comments, copy, docs, or the demo.

## Who it is for

A person watching a World Cup match on their phone who wants a second screen that is smarter than a scoreboard. They are not a trader. They do not want a wall of decimal odds. They want someone in the chat saying "the market just moved hard toward Morocco after that red card, here is why."

## The one job

When something happens on the pitch, or the odds move, Pitchwire sends one clear message explaining what changed and what it means. Everything else is secondary to getting that single loop excellent.

---

## Hard boundaries (do not cross these without stopping and asking)

1. **No custody. No execution. No wallets holding user funds.** The only on-chain action in this project is the TxLINE free-tier `subscribe` transaction, signed once by our own service wallet on Solana **devnet**, to unlock the data feed. That is it. If you find yourself writing code that signs a transaction on a user's behalf, or integrates Polymarket / Kairos / any market, stop and flag it.

2. **Frame as analysis, never as advice to bet.** Copy describes what the data shows and what the market is doing. It never tells a user to place a wager, never implies a guaranteed outcome, and never uses the word "tip" in the gambling sense. This is both an honesty rule and a regulatory-exposure rule (the builder is in Nigeria; betting-adjacent framing carries real risk).

3. **The predict game uses points, never money.** Streaks and scores are cosmetic. No buy-ins, no payouts, no token stakes.

4. **Server holds the clock, always.** Any prediction or guess is timestamped by our server against the TxLINE update sequence, never by the client. A guess that arrives after the relevant stat is known is rejected server-side. This is the anti-manipulation core; it is covered in detail in `docs/03-architecture.md`.

## Definition of done (what "submittable" means)

The hackathon is judged mainly on a five-minute demo video, and the matches end when the tournament ends (final is July 19, the same day submissions close). So the bar is:

- A deployed Telegram bot that a judge can open and use.
- It pulls **live** TxLINE World Cup data as its input (not mocked, not hardcoded).
- The core loop works end to end: match event or odds move in → plain-language explanation out.
- The predict-the-next-stat game works with a server-locked, un-gameable guess window.
- A clean demo recorded **during a live match** (your live-data windows are the quarterfinals, semis, third-place match, and final — do not miss them).
- A short technical write-up and the TxLINE feedback answered.

Anything past that (Mini App, charts, personalization, proactive push to many users) is a bonus only after the above is solid.

---

## How to work in this repo

- **Read the phase docs in order.** `docs/00` through `docs/07`. Each is a self-contained chunk of work. Finish one, commit, move on.
- **Use the project's own skills.** Before starting a task, check whether one of the available skills fits it, and use it. Explicit guidance on which skill for which job is in `docs/06-skills-routing.md`. Do not hand-roll something a skill does better.
- **Small commits, honest messages.** One logical change per commit. Message says what changed and why, not "update files."
- **Never invent API behaviour.** Every TxLINE endpoint, header, and field used in this project is documented in `docs/02-txline-reference.md`, taken from the real docs. If something you need is not in there, fetch the live doc and confirm before relying on it. Do not guess field names.
- **When unsure, stop and say so.** A flagged uncertainty is cheaper than a wrong assumption discovered on July 18.

## Voice for all user-facing copy

Pitchwire talks like a sharp friend who happens to know the data cold. Short sentences. Confident, not hypey. It explains, it does not sell. It never apologizes for itself and never pads. Full voice guide is in `docs/05-design.md`; follow it for every string a user sees.

## Tech stack (locked)

- **Runtime:** Node.js + TypeScript.
- **Bot:** Telegram Bot API via `grammy` (see `docs/04-bot-setup.md` for why grammy over alternatives).
- **Data:** TxLINE World Cup free tier over Server-Sent Events, plus REST snapshots. Solana devnet for the one subscribe transaction.
- **LLM:** Anthropic API for the explanation layer.
- **Store:** SQLite via `better-sqlite3` for the MVP (users, guesses, streaks, seen-event dedupe). No heavy database. Postgres is a later-if-ever concern.
- **Host:** a single small always-on Node process. Railway or Fly.io. Not serverless — SSE needs a long-lived connection.

Do not add to this stack without a reason that survives the "does the demo need it" test.
