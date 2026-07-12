import axios, { AxiosError, type AxiosInstance } from "axios";
import { apiBaseUrl, getApiToken, getJwt } from "./auth.js";
import { log } from "../lib/log.js";
import {
  FixtureSchema,
  OddsUpdateSchema,
  ScoreUpdateSchema,
  type Fixture,
  type OddsUpdate,
  type ScoreUpdate,
} from "./types.js";
import { z } from "zod";

/**
 * Authenticated REST client for TxLINE snapshots. Attaches both credentials on
 * every request and, on a 401, renews the guest JWT once and retries. The API
 * token itself does not expire, so 401 always means "renew the JWT".
 */

const http: AxiosInstance = axios.create({
  baseURL: apiBaseUrl,
  timeout: 20_000,
});

http.interceptors.request.use(async (cfg) => {
  const jwt = await getJwt();
  cfg.headers.set("Authorization", `Bearer ${jwt}`);
  cfg.headers.set("X-Api-Token", getApiToken());
  return cfg;
});

http.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const cfg = error.config as (typeof error.config & { _retried?: boolean }) | undefined;
    if (error.response?.status === 401 && cfg && !cfg._retried) {
      cfg._retried = true;
      log.warn("401 from TxLINE — renewing JWT and retrying once");
      const jwt = await getJwt(true);
      cfg.headers?.set?.("Authorization", `Bearer ${jwt}`);
      return http.request(cfg);
    }
    return Promise.reject(error);
  }
);

/** Parse an array payload leniently: keep the rows that validate, log the rest. */
function parseArray<T>(schema: z.ZodType<T>, data: unknown, what: string): T[] {
  const rows = Array.isArray(data) ? data : (data as { items?: unknown[] })?.items ?? [];
  const out: T[] = [];
  let skipped = 0;
  for (const row of rows as unknown[]) {
    const parsed = schema.safeParse(row);
    if (parsed.success) out.push(parsed.data);
    else skipped++;
  }
  if (skipped) log.warn(`Skipped ${skipped} malformed ${what} row(s)`);
  return out;
}

/** All fixtures, optionally filtered to one competition. */
export async function getFixtures(competitionId?: number): Promise<Fixture[]> {
  const res = await http.get("/fixtures/snapshot", {
    params: competitionId != null ? { competitionId } : undefined,
  });
  return parseArray(FixtureSchema, res.data, "fixture");
}

/** Current score state for one fixture. */
export async function getScoreSnapshot(fixtureId: number): Promise<ScoreUpdate | null> {
  const res = await http.get(`/scores/snapshot/${fixtureId}`);
  const data = Array.isArray(res.data) ? res.data[res.data.length - 1] : res.data;
  const parsed = ScoreUpdateSchema.safeParse(data);
  if (!parsed.success) {
    log.warn("Malformed score snapshot", { fixtureId });
    return null;
  }
  return parsed.data;
}

/** Current odds for one fixture (may be several market lines). */
export async function getOddsSnapshot(fixtureId: number): Promise<OddsUpdate[]> {
  const res = await http.get(`/odds/snapshot/${fixtureId}`);
  return parseArray(OddsUpdateSchema, res.data, "odds");
}

/**
 * Full score sequence for a fixture that started 6h–2wk ago. This is the
 * between-matches testing/demo lever the docs recommend: replay a real sequence
 * through the decode + engine pipeline without waiting for a live match.
 */
export async function getScoresHistorical(fixtureId: number): Promise<ScoreUpdate[]> {
  const res = await http.get(`/scores/historical/${fixtureId}`);
  const rows = parseArray(ScoreUpdateSchema, res.data, "historical score");
  return rows.sort((a, b) => a.seq - b.seq);
}

export { http as txlineHttp };
