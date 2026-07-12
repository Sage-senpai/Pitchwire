/**
 * A deliberately tiny structured logger. No dependency, no ceremony — and
 * deliberately independent of the validated config so it can be used from any
 * module (and any unit test) without triggering env validation. It reads
 * LOG_LEVEL straight from the environment with a safe default.
 *
 * Every feed value we log should carry its `seq`/`ts` so a mid-demo oddity can
 * be traced back to the exact feed update that triggered it.
 */
type Level = "debug" | "info" | "warn" | "error";

const ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const envLevel = (process.env.LOG_LEVEL ?? "info") as Level;
const threshold = ORDER[envLevel] ?? ORDER.info;

function emit(level: Level, msg: string, meta?: Record<string, unknown>): void {
  if (ORDER[level] < threshold) return;
  const stamp = new Date().toISOString();
  const tail = meta && Object.keys(meta).length ? " " + JSON.stringify(meta) : "";
  const line = `${stamp} ${level.toUpperCase().padEnd(5)} ${msg}${tail}`;
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const log = {
  debug: (msg: string, meta?: Record<string, unknown>) => emit("debug", msg, meta),
  info: (msg: string, meta?: Record<string, unknown>) => emit("info", msg, meta),
  warn: (msg: string, meta?: Record<string, unknown>) => emit("warn", msg, meta),
  error: (msg: string, meta?: Record<string, unknown>) => emit("error", msg, meta),
};
