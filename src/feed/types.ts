import { z } from "zod";

/**
 * Zod schemas for every TxLINE payload we parse, plus the single internal
 * event type the rest of the app consumes. Field names are taken verbatim from
 * the TxLINE OpenAPI spec (https://txline.txodds.com/docs/docs.yaml):
 *   - Fixture    : PascalCase fields
 *   - Scores     : camelCase fields, `stats` is a map of statKey -> value
 *   - OddsPayload: PascalCase fields, aligned PriceNames/Prices/Pct arrays
 *
 * We only pick the fields we use and stay tolerant of everything else — if a
 * payload fails its schema we log and skip it rather than crashing the feed.
 */

// ---- Raw TxLINE payloads -------------------------------------------------

export const FixtureSchema = z
  .object({
    FixtureId: z.number(),
    Participant1: z.string(),
    Participant2: z.string(),
    Participant1Id: z.number().optional(),
    Participant2Id: z.number().optional(),
    // Neutral-venue caveat: for the World Cup this is a home/away *slot mapping*,
    // not a venue guarantee. Never render it as "playing at home".
    Participant1IsHome: z.boolean().optional(),
    StartTime: z.number(),
    Competition: z.string().optional(),
    CompetitionId: z.number().optional(),
    Ts: z.number().optional(),
  })
  .passthrough();
export type Fixture = z.infer<typeof FixtureSchema>;

/**
 * Score payloads arrive in two serializations: the SSE stream uses camelCase
 * (`seq`, `ts`, `stats`, `gameState`), while the REST snapshot uses PascalCase
 * (`Seq`, `Ts`, `Stats`, `StatusId`) with an unreliable `GameState` ("scheduled"
 * even at 90'). We normalize both to one internal shape before validating, and
 * keep `statusId` as the reliable phase signal for the REST format.
 */
export const ScoreUpdateSchema = z.preprocess(
  (raw) => {
    if (!raw || typeof raw !== "object") return raw;
    const r = raw as Record<string, unknown>;
    return {
      fixtureId: r.fixtureId ?? r.FixtureId,
      seq: r.seq ?? r.Seq,
      ts: r.ts ?? r.Ts,
      gameState: r.gameState ?? r.GameState,
      statusId: r.statusId ?? r.StatusId,
      stats: r.stats ?? r.Stats,
    };
  },
  z
    .object({
      fixtureId: z.number(),
      seq: z.number(),
      ts: z.number(),
      gameState: z.string().optional(),
      statusId: z.number().optional(),
      // Map of encoded stat key (as string) -> integer value.
      stats: z.record(z.string(), z.number()).optional(),
    })
    .passthrough()
);
export type ScoreUpdate = z.infer<typeof ScoreUpdateSchema>;

export const OddsUpdateSchema = z
  .object({
    FixtureId: z.number(),
    Ts: z.number(),
    MessageId: z.string().optional(),
    Bookmaker: z.string().optional(),
    SuperOddsType: z.string().optional(),
    GameState: z.string().optional(),
    InRunning: z.boolean().optional(),
    MarketPeriod: z.string().optional(),
    MarketParameters: z.string().optional(),
    PriceNames: z.array(z.string()),
    Prices: z.array(z.number()),
    // Demargined StablePrice percentage per outcome, 3dp, or "NA".
    Pct: z.array(z.string()).optional(),
  })
  .passthrough();
export type OddsUpdate = z.infer<typeof OddsUpdateSchema>;

// ---- Decoded / internal shapes ------------------------------------------

/** A single decoded soccer stat, e.g. total corners for the home slot. */
export interface DecodedStat {
  key: number; // raw encoded key
  base: number; // 1..8
  period: number; // 0 (total), 1000 (1H), ... — see decode.ts
  periodLabel: string;
  label: string; // human label, e.g. "corners (home)"
  participant: 1 | 2 | null;
  value: number;
}

export interface DecodedOutcome {
  name: string; // e.g. "1", "X", "2" or team name as given
  price: number; // raw StablePrice integer, carried but not over-interpreted
  impliedPct: number | null; // demargined implied chance, 0..100, or null for NA
}

export interface DecodedOdds {
  marketType: string | null; // SuperOddsType
  period: string | null; // MarketPeriod
  inRunning: boolean;
  outcomes: DecodedOutcome[];
}

/** Coarse match phase used to decide whether a match is live/predictable. */
export type GamePhase =
  | "not_started"
  | "first_half"
  | "halftime"
  | "second_half"
  | "extra_time"
  | "penalties"
  | "ended"
  | "unknown";

/** The one event type the feed emits and the engine consumes. */
export type FeedEvent =
  | {
      kind: "score";
      fixtureId: number;
      seq: number;
      ts: number;
      phase: GamePhase;
      gameStateRaw: string | null;
      stats: DecodedStat[];
    }
  | {
      kind: "odds";
      fixtureId: number;
      seq: number; // odds carry no seq; we use Ts as the ordering key
      ts: number;
      messageId: string | null;
      markets: DecodedOdds;
    };
