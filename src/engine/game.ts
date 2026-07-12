import type { DecodedStat } from "../feed/types.js";
import { totalStat } from "../feed/decode.js";

/**
 * Game stat semantics: which decoded numbers a chosen stat maps to. Corners is
 * the default — it moves often, is unambiguous, and carries no emotional weight.
 * Scoring itself lives in store.ts (`scoreGuess`); this is just the "what number
 * are we tracking" mapping, kept separate so it can be unit-tested.
 */
export function statValue(stats: DecodedStat[], stat: string): number {
  switch (stat) {
    case "goals":
      return totalStat(stats, 1) + totalStat(stats, 2);
    case "cards":
      return (
        totalStat(stats, 3) +
        totalStat(stats, 4) +
        totalStat(stats, 5) +
        totalStat(stats, 6)
      );
    case "corners":
    default:
      return totalStat(stats, 7) + totalStat(stats, 8);
  }
}

/** Human label for a chosen stat, for game copy. */
export function statLabel(stat: string): string {
  switch (stat) {
    case "goals":
      return "goals";
    case "cards":
      return "cards";
    case "corners":
    default:
      return "corners";
  }
}
