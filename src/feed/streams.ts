import { getApiToken, getJwt, apiBaseUrl } from "./auth.js";
import { log } from "../lib/log.js";

/**
 * SSE consumers for the scores and odds streams.
 *
 * The parser helpers (`parseSseBlock`, `readSseMessages`, `parseSseData`) are
 * taken VERBATIM from the TxLINE docs
 * (https://txline.txodds.com/documentation/examples/streaming-data) — do not
 * rewrite them, theirs is correct.
 *
 * Everything TxLINE-specific is in the reconnect wrapper: long-lived SSE
 * connections drop, so each stream runs in a reconnect-with-backoff loop that
 * renews the guest JWT on every (re)connect. A stream that never reconnects is
 * a dead demo — this loop is the single most important reliability detail here.
 */

// ---- TxLINE SSE parser helpers (verbatim) --------------------------------

type SseMessage = {
  id?: string;
  event?: string;
  data: string;
  retry?: number;
};

function parseSseBlock(block: string): SseMessage | null {
  const message: SseMessage = { data: "" };

  for (const rawLine of block.split(/\r?\n/)) {
    if (!rawLine || rawLine.startsWith(":")) continue;

    const separatorIndex = rawLine.indexOf(":");
    const field = separatorIndex === -1 ? rawLine : rawLine.slice(0, separatorIndex);
    const value =
      separatorIndex === -1 ? "" : rawLine.slice(separatorIndex + 1).replace(/^ /, "");

    if (field === "data") message.data += `${value}\n`;
    if (field === "event") message.event = value;
    if (field === "id") message.id = value;
    if (field === "retry") message.retry = Number(value);
  }

  message.data = message.data.replace(/\n$/, "");
  return message.data || message.event || message.id ? message : null;
}

async function* readSseMessages(response: Response): AsyncGenerator<SseMessage> {
  if (!response.body) throw new Error("Stream response has no body");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      let separator = buffer.match(/\r?\n\r?\n/);
      while (separator?.index !== undefined) {
        const block = buffer.slice(0, separator.index);
        buffer = buffer.slice(separator.index + separator[0].length);

        const message = parseSseBlock(block);
        if (message) yield message;

        separator = buffer.match(/\r?\n\r?\n/);
      }
    }

    buffer += decoder.decode();
    const message = parseSseBlock(buffer);
    if (message) yield message;
  } finally {
    reader.releaseLock();
  }
}

function parseSseData(data: string): unknown {
  try {
    return JSON.parse(data);
  } catch {
    return data;
  }
}

// ---- Reconnecting stream runner ------------------------------------------

export type StreamKind = "scores" | "odds";

export interface StreamHandle {
  stop(): void;
}

const BACKOFF_MIN_MS = 1_000;
const BACKOFF_MAX_MS = 30_000;

/**
 * Open one SSE stream and pump decoded JSON payloads to `onData` until stopped.
 * Reconnects forever with exponential backoff; renews the JWT each attempt.
 * `event` messages that are heartbeats (no JSON body) are ignored.
 */
export function runStream(
  kind: StreamKind,
  onData: (payload: unknown) => void
): StreamHandle {
  const url = `${apiBaseUrl}/${kind}/stream`;
  let stopped = false;
  let backoff = BACKOFF_MIN_MS;
  let controller: AbortController | null = null;

  async function loop(): Promise<void> {
    while (!stopped) {
      controller = new AbortController();
      try {
        const jwt = await getJwt(true); // fresh JWT on every (re)connect
        const res = await fetch(url, {
          headers: {
            Authorization: `Bearer ${jwt}`,
            "X-Api-Token": getApiToken(),
            Accept: "text/event-stream",
            "Cache-Control": "no-cache",
          },
          signal: controller.signal,
        });

        if (!res.ok) {
          throw new Error(`stream ${kind} HTTP ${res.status}`);
        }

        log.info(`SSE ${kind} stream connected`);
        backoff = BACKOFF_MIN_MS; // reset backoff on a good connection

        for await (const message of readSseMessages(res)) {
          if (stopped) break;
          if (message.event === "heartbeat") continue;
          const payload = parseSseData(message.data);
          if (payload && typeof payload === "object") onData(payload);
        }

        if (!stopped) log.warn(`SSE ${kind} stream ended; reconnecting`);
      } catch (err) {
        if (stopped) break;
        log.warn(`SSE ${kind} stream error; reconnecting`, { error: String(err) });
      }

      if (stopped) break;
      await sleep(backoff);
      backoff = Math.min(backoff * 2, BACKOFF_MAX_MS);
    }
  }

  void loop();

  return {
    stop() {
      stopped = true;
      controller?.abort();
      log.info(`SSE ${kind} stream stopped`);
    },
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
