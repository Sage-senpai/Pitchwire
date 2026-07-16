import type {
  DecodedOdds,
  DecodedStat,
  GamePhase,
  OddsUpdate,
  ScoreUpdate,
} from "./types.js";

/**
 * Turn raw TxLINE payloads into human-readable, typed values. No I/O here — pure
 * functions so they can be unit-tested against replayed historical sequences.
 *
 * Stat key encoding (TxLINE soccer feed): key = period_prefix + base_key.
 *   base keys 1..8 are agreed across every TxLINE source:
 *     1 P1 goals   2 P2 goals   3 P1 yellow  4 P2 yellow
 *     5 P1 red     6 P2 red     7 P1 corners 8 P2 corners
 *   period prefixes per the live soccer-feed doc:
 *     0 total · 1000 first half · 2000 halftime · 3000 second half
 *     6000 penalties · 7000 extra time
 * NOTE: docs/02 lists slightly different period multipliers than the live
 * soccer-feed page; the discrepancy only affects half-specific *display* labels.
 * The game depends only on the base keys (7/8 = corners) and full-game totals,
 * which every source agrees on, so it is unaffected. Unknown periods degrade to
 * a "period N" label rather than a wrong one.
 */

const BASE_LABELS: Record<number, { label: string; participant: 1 | 2 }> = {
  1: { label: "goals (home)", participant: 1 },
  2: { label: "goals (away)", participant: 2 },
  3: { label: "yellow cards (home)", participant: 1 },
  4: { label: "yellow cards (away)", participant: 2 },
  5: { label: "red cards (home)", participant: 1 },
  6: { label: "red cards (away)", participant: 2 },
  7: { label: "corners (home)", participant: 1 },
  8: { label: "corners (away)", participant: 2 },
};

const PERIOD_LABELS: Record<number, string> = {
  0: "total",
  1000: "1st half",
  2000: "halftime",
  3000: "2nd half",
  6000: "penalties",
  7000: "extra time",
};

export function periodLabel(period: number): string {
  return PERIOD_LABELS[period] ?? `period ${period / 1000}`;
}

export function decodeStat(key: number, value: number): DecodedStat {
  const base = key % 1000;
  const period = key - base;
  const meta = BASE_LABELS[base];
  return {
    key,
    base,
    period,
    periodLabel: periodLabel(period),
    label: meta ? meta.label : `stat ${base}`,
    participant: meta ? meta.participant : null,
    value,
  };
}

export function decodeStats(update: ScoreUpdate): DecodedStat[] {
  const out: DecodedStat[] = [];
  for (const [rawKey, value] of Object.entries(update.stats ?? {})) {
    const key = Number(rawKey);
    if (!Number.isFinite(key)) continue;
    out.push(decodeStat(key, value));
  }
  return out;
}

/**
 * The Hi-Lo game stat: combined total corners (base keys 7 + 8, total period).
 * Returns 0 if not present yet. Corners are the right game stat — they move
 * often, are unambiguous, and carry no emotional weight.
 */
export function totalCorners(stats: DecodedStat[]): number {
  return stats
    .filter((s) => s.period === 0 && (s.base === 7 || s.base === 8))
    .reduce((sum, s) => sum + s.value, 0);
}

/** Read a single total-period base stat (e.g. base 7) or 0. */
export function totalStat(stats: DecodedStat[], base: number): number {
  const hit = stats.find((s) => s.period === 0 && s.base === base);
  return hit ? hit.value : 0;
}

/**
 * Decode `gameState`. TxLINE types it as a string; in practice it is a
 * stringified numeric code. We map the known codes and fall back to `unknown`
 * so a match we can't classify is treated as not-live rather than mis-driven.
 * Numeric codes per docs/02: 1 not started · 2 1H · 3 HT · 4 2H · 5 ended
 * · 12 penalties · 13 ended after pens. String status codes (from the spec's
 * SoccerFixtureStatus) are also handled.
 */
const NUMERIC_PHASE: Record<string, GamePhase> = {
  "1": "not_started",
  "2": "first_half",
  "3": "halftime",
  "4": "second_half",
  "5": "ended",
  "10": "ended",
  "12": "penalties",
  "13": "ended",
};

const STRING_PHASE: Record<string, GamePhase> = {
  NS: "not_started",
  H1: "first_half",
  H11: "first_half",
  HT: "halftime",
  HT2: "halftime",
  H2: "second_half",
  H21: "second_half",
  ET1: "extra_time",
  ET2: "extra_time",
  HTET: "extra_time",
  P: "penalties",
  PE: "penalties",
  END: "ended",
  FET: "ended",
  FPE: "ended",
  WET: "ended",
  WPE: "ended",
};

export function decodePhase(gameState: string | undefined | null): GamePhase {
  if (gameState == null) return "unknown";
  const s = gameState.trim();
  if (s in NUMERIC_PHASE) return NUMERIC_PHASE[s];
  const upper = s.toUpperCase();
  if (upper in STRING_PHASE) return STRING_PHASE[upper];
  return "unknown";
}

/**
 * The REST snapshot's numeric `StatusId` (its `GameState` string is unreliable —
 * it reads "scheduled" even at 90'). Observed live: 1 pre-match, 3 halftime,
 * 4 in-play, 5/100 finished.
 */
const STATUS_PHASE: Record<number, GamePhase> = {
  1: "not_started",
  2: "first_half",
  3: "halftime",
  4: "second_half",
  5: "ended",
  6: "extra_time",
  12: "penalties",
  100: "ended",
};

/** Resolve phase preferring a mappable `gameState`, then `statusId`. */
export function resolvePhase(
  gameState: string | undefined | null,
  statusId: number | undefined | null
): GamePhase {
  const byState = decodePhase(gameState);
  if (byState !== "unknown") return byState;
  if (statusId != null && statusId in STATUS_PHASE) return STATUS_PHASE[statusId];
  return "unknown";
}

/** A match is worth watching / predicting only while the ball is in play. */
export function isLivePhase(phase: GamePhase): boolean {
  return (
    phase === "first_half" ||
    phase === "second_half" ||
    phase === "extra_time" ||
    phase === "penalties"
  );
}

/**
 * Decode odds. We describe the market via the demargined StablePrice `Pct`
 * (the honest "what the market thinks" number). We carry the raw `Prices`
 * integers but deliberately do NOT reinterpret their scale, so we never
 * misrepresent StablePrice as raw bookmaker decimal odds.
 */
export function decodeOdds(update: OddsUpdate): DecodedOdds {
  const outcomes = update.PriceNames.map((name, i) => {
    const rawPct = update.Pct?.[i];
    let impliedPct: number | null = null;
    if (rawPct && rawPct !== "NA") {
      const n = Number(rawPct);
      if (Number.isFinite(n)) impliedPct = n <= 1 ? n * 100 : n;
    }
    return {
      name,
      price: update.Prices[i] ?? 0,
      impliedPct,
    };
  });
  return {
    marketType: update.SuperOddsType ?? null,
    period: update.MarketPeriod ?? null,
    inRunning: update.InRunning ?? false,
    outcomes,
  };
}
