import type { DecodedOdds, DecodedStat, GamePhase } from "../feed/types.js";
import { totalStat } from "../feed/decode.js";

/**
 * Deterministic "is this worth a message?" filter. Runs in plain code BEFORE we
 * ever spend an LLM call. A corner ticking 3->4 is not worth interrupting a fan;
 * a goal, a red card, a phase change, or a hard odds move is.
 *
 * Significance is intentionally conservative — a quiet wire beats a noisy one.
 */

export interface ScoreSignificance {
  significant: boolean;
  reason: string; // machine tag, e.g. "goal_home"
  fact: string; // plain human fact, used for the prompt and the fallback
}

// Odds move that counts as significant, in percentage points of implied chance.
const ODDS_MOVE_THRESHOLD_PCT = 5;

const PHASE_HEADLINE: Partial<Record<GamePhase, string>> = {
  halftime: "Halftime.",
  ended: "Full time.",
  penalties: "Penalties.",
};

/**
 * Score significance from the change since the previous update. `prev` is null
 * on the first update we hold for a fixture (a fresh connect), which is never
 * treated as significant on its own — we don't want to fire on a snapshot.
 */
export function scoreSignificance(
  curr: DecodedStat[],
  prev: DecodedStat[] | null,
  currPhase: GamePhase,
  prevPhase: GamePhase | null
): ScoreSignificance {
  const none: ScoreSignificance = { significant: false, reason: "none", fact: "" };
  if (!prev) return none;

  const dHomeGoals = totalStat(curr, 1) - totalStat(prev, 1);
  const dAwayGoals = totalStat(curr, 2) - totalStat(prev, 2);
  const dHomeRed = totalStat(curr, 5) - totalStat(prev, 5);
  const dAwayRed = totalStat(curr, 6) - totalStat(prev, 6);

  if (dHomeGoals > 0) return { significant: true, reason: "goal_home", fact: "The home side scored." };
  if (dAwayGoals > 0) return { significant: true, reason: "goal_away", fact: "The away side scored." };
  if (dHomeRed > 0) return { significant: true, reason: "red_home", fact: "The home side went down to a red card." };
  if (dAwayRed > 0) return { significant: true, reason: "red_away", fact: "The away side went down to a red card." };

  if (prevPhase && currPhase !== prevPhase && currPhase in PHASE_HEADLINE) {
    return {
      significant: true,
      reason: `phase_${currPhase}`,
      fact: PHASE_HEADLINE[currPhase] as string,
    };
  }

  return none;
}

export interface OddsFavourite {
  name: string;
  pct: number;
}

export interface OddsSignificance {
  significant: boolean;
  reason: string;
  fact: string;
  favourite: OddsFavourite | null; // the new favourite state, to carry forward
}

/** The strongest outcome in a market (highest implied chance), if any. */
export function favouriteOf(odds: DecodedOdds): OddsFavourite | null {
  let best: OddsFavourite | null = null;
  for (const o of odds.outcomes) {
    if (o.impliedPct == null) continue;
    if (!best || o.impliedPct > best.pct) best = { name: o.name, pct: o.impliedPct };
  }
  return best;
}

/**
 * Odds significance: the favourite changed, or its implied chance moved past the
 * threshold since we last looked. `prev` is the favourite state we carried from
 * the last significant (or first) odds event for this fixture.
 */
export function oddsSignificance(
  odds: DecodedOdds,
  prev: OddsFavourite | null
): OddsSignificance {
  const fav = favouriteOf(odds);
  if (!fav) return { significant: false, reason: "no_market", fact: "", favourite: prev };
  if (!prev) {
    // First reading — carry it forward but don't announce a snapshot.
    return { significant: false, reason: "first", fact: "", favourite: fav };
  }

  if (fav.name !== prev.name) {
    return {
      significant: true,
      reason: "lead_change",
      fact: `The market's favourite flipped to ${fav.name} (${fav.pct.toFixed(0)}%).`,
      favourite: fav,
    };
  }

  const move = fav.pct - prev.pct;
  if (Math.abs(move) >= ODDS_MOVE_THRESHOLD_PCT) {
    const dir = move > 0 ? "toward" : "away from";
    return {
      significant: true,
      reason: "odds_move",
      fact: `The market swung ${dir} ${fav.name}, now ${fav.pct.toFixed(0)}%.`,
      favourite: fav,
    };
  }

  return { significant: false, reason: "quiet", fact: "", favourite: prev };
}
