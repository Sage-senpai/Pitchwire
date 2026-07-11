# 06 — Skills Routing

You (Claude Code) have a set of skills available. Reaching for the right one instead of hand-rolling is part of doing this well. This doc maps the tasks in this project to the skill that should handle them. Before starting any task, check this list. When a skill fits, read its `SKILL.md` first and follow it — do not improvise something a skill already encodes.

The rule: **a skill exists because it captures environment-specific things your training data does not have or gets wrong.** Skipping it lowers quality even on things you think you know.

## Direct mappings for this build

| Task in this project | Skill to use | Why |
|---|---|---|
| The landing page, the wire-card visual, the bot avatar, any web UI | `frontend-design` | It carries the anti-generic design discipline. It is the reason the output will not look like default AI slop. Read it before designing any surface. Pair it with the tokens in `docs/05-design.md`. |
| Applying the "signal room" palette + type consistently across the landing page / card | `theme-factory` | Turns the design tokens into a coherent applied theme instead of ad-hoc CSS. Use it to keep colour and type decisions derived from the token system, not reinvented per file. |
| The technical write-up, the architecture doc for judges, the README | `docx` (only if a Word file is explicitly wanted) or plain markdown otherwise | The write-up for Superteam Earn is markdown/inline, not a Word doc — do NOT reach for docx unless a downloadable Word deliverable is actually requested. Keep it markdown. |
| A submission PDF, if the hackathon wants one | `pdf` | Only if a PDF is explicitly required. It is not, per the brief — the brief wants a demo video, a live link, and a short write-up. Do not generate a PDF nobody asked for. |
| Any code you write | `frontend-design` for UI code; otherwise no skill — just write clean TypeScript | Most of this project is backend logic with no skill. Do not force a skill where none fits. |
| Reviewing your own code before the final push | `code-review` (from the engineering plugin, if available) | A pre-submission pass for the fund-boundary check, the auth-renewal logic, and the game-lock correctness is worth one focused review. |

## Skills to deliberately NOT use

Being disciplined about what *not* to invoke matters as much as picking the right one:

- **No data-analysis / dashboard / SQL skills** for the core product. TxLINE is the data layer; you are not building an analytics warehouse. If you find yourself reaching for a dashboard skill, you are rebuilding the sportsbook UI the design doc warns against.
- **No presentation/pptx skill.** The brief explicitly disqualifies pitch-deck-only submissions. The deliverable is a working product and a demo video, not slides. Do not build a deck.
- **No CRM / research / talent / bio / finance skills.** None of them touch this project. Ignore them.
- **No Canva/Adobe design skills unless you specifically want a quick social asset** for promoting the submission — and even then, the bespoke wire-card built with `frontend-design` will look more distinctive than a template. Prefer the bespoke route for anything a judge sees.

## The judgment call

When a task appears and no row above obviously fits: ask whether the task produces something a human will see and judge (a surface → probably `frontend-design`), or whether it is internal logic (→ no skill, just good code). Do not invoke a skill to look thorough. Invoke it when it genuinely raises the floor.

If you are ever unsure whether a skill applies, read its `SKILL.md` description — the description says exactly when it should trigger — and decide from that. A thirty-second read beats a wrong guess in either direction.

Commit, then open `07-demo-and-submit.md`.
