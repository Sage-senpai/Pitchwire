import axios from "axios";
import { config } from "../config.js";
import { log } from "../lib/log.js";

/**
 * TxLINE uses two credentials on every data request:
 *   - Authorization: Bearer <jwt>   — from /auth/guest/start, EXPIRES
 *   - X-Api-Token: <apiToken>        — from /api/token/activate, does NOT expire
 *
 * So at runtime we only ever have to refresh the guest JWT. We cache it and
 * renew it proactively (well before expiry) so it never dies mid-match, and
 * also expose a forced refresh for the 401-retry path.
 */

const origin = config.TXLINE_API_ORIGIN.replace(/\/$/, "");
export const guestStartUrl = `${origin}/auth/guest/start`;
export const apiBaseUrl = `${origin}/api`;

// Renew the guest JWT this often regardless of expiry. TxLINE JWTs are
// short-lived; 8 minutes keeps a comfortable margin without hammering auth.
const JWT_TTL_MS = 8 * 60 * 1000;

let cachedJwt: string | null = null;
let cachedAt = 0;
let inflight: Promise<string> | null = null;

async function fetchGuestJwt(): Promise<string> {
  const res = await axios.post(guestStartUrl, {}, { timeout: 15_000 });
  const token: unknown = res.data?.token ?? res.data;
  if (typeof token !== "string" || token.length === 0) {
    throw new Error("guest/start returned no token");
  }
  return token;
}

/**
 * Return a valid guest JWT, renewing if the cached one is stale.
 * Concurrent callers share a single in-flight renewal.
 */
export async function getJwt(force = false): Promise<string> {
  const fresh = cachedJwt && Date.now() - cachedAt < JWT_TTL_MS;
  if (fresh && !force) return cachedJwt as string;
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      const jwt = await fetchGuestJwt();
      cachedJwt = jwt;
      cachedAt = Date.now();
      log.debug("Renewed guest JWT");
      return jwt;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

/** The activated API token. Set once via env after running `npm run activate`. */
export function getApiToken(): string {
  const token = config.TXLINE_API_TOKEN;
  if (!token) {
    throw new Error(
      "TXLINE_API_TOKEN is not set. Run `npm run activate` once to subscribe " +
        "on-chain and activate the token, then put it in .env."
    );
  }
  return token;
}

export function hasApiToken(): boolean {
  return Boolean(config.TXLINE_API_TOKEN);
}
