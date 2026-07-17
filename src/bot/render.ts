import type { GamePhase } from "../feed/index.js";
import type { OutboundMessage } from "../engine/index.js";
import { statLabel } from "../engine/index.js";

/**
 * All user-facing formatting lives here so Pitchwire's voice and rhythm are
 * decided in one place. Parse mode is HTML throughout (more forgiving than
 * MarkdownV2). Bold the one thing that matters; nothing else.
 *
 * The signature element is the wire dateline — a compact monospace line that
 * carries real telemetry (phase, feed sequence) before the signal, the way an
 * old telegraph message opened with place and time.
 */

export const PARSE_MODE = "HTML" as const;

export function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const PHASE_SHORT: Record<GamePhase, string> = {
  not_started: "PRE",
  first_half: "1H",
  halftime: "HT",
  second_half: "2H",
  extra_time: "ET",
  penalties: "PENS",
  ended: "FT",
  unknown: "LIVE",
};

const RULE = "━━━━━━━━━━━━━━━━";

/** The wire dateline: LABEL · PHASE · SEQ n, in monospace. */
export function dateline(label: string, phase: GamePhase, seq: number): string {
  return `<code>${esc(label.toUpperCase())} · ${PHASE_SHORT[phase]} · SEQ ${seq}</code>`;
}

/** The placeholder shown the instant a signal starts arriving, before the edit. */
export function readingPlaceholder(label: string, phase: GamePhase, seq: number): string {
  return `${dateline(label, phase, seq)}\n${RULE}\n<i>Reading the play…</i>`;
}

/** The composed read-out: dateline, rule, then the signal. */
export function explanationMessage(msg: Extract<OutboundMessage, { kind: "explanation" }>): string {
  return `${dateline(msg.label, msg.phase, msg.seq)}\n${RULE}\n${esc(msg.text)}`;
}

export function gameResultMessage(msg: Extract<OutboundMessage, { kind: "game_result" }>): string {
  const stat = statLabel(msg.stat);
  const moved = msg.actual > msg.baseline;
  const movement = moved
    ? `${stat} went ${msg.baseline} → ${msg.actual}`
    : `${stat} held at ${msg.actual}`;
  if (msg.result === "correct") {
    const flourish = msg.currentStreak >= 3 ? " The wire's running hot." : "";
    return `<b>Right.</b> ${cap(movement)}. Streak <b>${msg.currentStreak}</b>.${flourish}`;
  }
  return `<b>Missed.</b> ${cap(movement)}. Streak back to 0. Best still ${msg.bestStreak}.`;
}

// ---- static copy (all in voice) -----------------------------------------

export const START = [
  "<b>Pitchwire</b> is on the line.",
  "",
  "I read the match and the market and tell you what just changed — one clear signal at a time. No wall of odds. No noise.",
  "",
  "Tap below to see what's live.",
].join("\n");

export function watchConfirm(label: string): string {
  return `On the wire for <b>${esc(label)}</b>. I'll send the signal when something moves.`;
}

export function noMatchesLive(): string {
  return "Wire's quiet. No World Cup match live right now — check back near kickoff.";
}

export function guessPrompt(label: string, stat: string, value: number): string {
  return [
    `<b>${esc(label)}</b>`,
    `${cap(statLabel(stat))} so far: <b>${value}</b>.`,
    "",
    `By the next update — higher, or same or lower?`,
  ].join("\n");
}

export function guessCommitted(dir: "higher" | "same_or_lower"): string {
  const call = dir === "higher" ? "higher" : "same or lower";
  return `Locked: <b>${call}</b>. Server's holding the clock — no taking it back.`;
}

export function guessNoRound(): string {
  return "Wire's between updates — no round open. Try again once play moves.";
}

export function guessNoMatch(): string {
  return "Follow a live match first with /matches, then play.";
}

export function guessAlready(): string {
  return "You're already in this round. One call each — sit tight for the update.";
}

export function streakMessage(current: number, best: number): string {
  if (best === 0) return "No run yet. Play a round with /guess.";
  return `Current run: <b>${current}</b>. Best: <b>${best}</b>.`;
}

export const STOPPED = "Off the wire. Nothing more from me until you're back.";

/**
 * The proof read-out. Shows that a scoreline is TxLINE's own number, backed by a
 * Merkle proof whose day-root is anchored on Solana. Honest framing: we surface
 * the proof and its on-chain anchor, we don't claim to have re-derived the tree.
 */
export function verifyMessage(
  label: string,
  a: {
    stats: { key: number; value: number }[];
    eventStatRootHex: string;
    dailyRootPda: string;
    onChain: boolean;
    verified: boolean | null;
    explorerUrl: string;
  }
): string {
  const goals = a.stats.filter((s) => s.key === 1 || s.key === 2);
  const score = goals.length === 2 ? `${goals[0].value}–${goals[1].value}` : "current";
  const rootShort = a.eventStatRootHex
    ? `${a.eventStatRootHex.slice(0, 6)}…${a.eventStatRootHex.slice(-6)}`
    : "n/a";
  const pdaShort = `${a.dailyRootPda.slice(0, 4)}…${a.dailyRootPda.slice(-4)}`;

  const headline =
    a.verified === true
      ? "<b>✓ Verified on-chain.</b>"
      : a.verified === false
        ? "<b>Proof did not verify.</b>"
        : "Proof anchored on-chain.";
  const explain =
    a.verified === true
      ? `The Solana program checked the Merkle proof against the day's root and confirmed the <b>${score}</b> scoreline. It's TxLINE's own number, not mine.`
      : a.verified === false
        ? `The on-chain check rejected this. Treat it as unconfirmed.`
        : `The <b>${score}</b> scoreline carries a Merkle proof whose day-root is anchored on Solana devnet.`;

  return [
    `<code>${esc(label.toUpperCase())} · PROOF</code>`,
    RULE,
    headline,
    explain,
    "",
    `<code>stat root ${rootShort}</code>`,
    `<code>day-root PDA ${esc(pdaShort)}</code>`,
    "",
    `<a href="${a.explorerUrl}">See the root on Solana Explorer</a>`,
  ].join("\n");
}

export function verifyUnavailable(): string {
  return "Couldn't pull the on-chain proof just now. The wire's still honest — seq and ts are on every read.";
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
