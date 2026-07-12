import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { log } from "../lib/log.js";

// Default DB path. The app passes config.DATABASE_PATH explicitly; keeping the
// default a plain literal (not a config import) lets the store be imported and
// unit-tested without the full runtime environment.
const DEFAULT_DB_PATH = "data/pitchwire.db";

/**
 * SQLite store. Synchronous (better-sqlite3), which is a feature here: the
 * engine processes feed events one at a time, so the round lock is naturally
 * serialized — a guess can never be committed to a round that has already been
 * closed, because closing and committing cannot interleave mid-operation.
 *
 * The un-gameable guarantee (see docs/03-architecture.md):
 *   - A round is keyed by the feed's own sequence number, not wall-clock time.
 *   - `settleOpenRound` closes the prior round atomically BEFORE the new value
 *     is revealed. Any guess not already committed is rejected by construction.
 *   - Every guess is stamped server-side with the seq it locked to and the
 *     server receive time. The client's claimed time is ignored entirely.
 */

export type Direction = "higher" | "same_or_lower";
export type GuessResult = "correct" | "wrong";

export interface Round {
  fixtureId: number;
  openSeq: number;
  stat: string;
  baselineValue: number;
  status: "open" | "settled";
  actualValue: number | null;
}

export interface CommitOutcome {
  ok: boolean;
  reason?: "no_open_round" | "already_guessed";
}

export interface SettledGuess {
  userId: number;
  direction: Direction;
  result: GuessResult;
  currentStreak: number;
  bestStreak: number;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  telegram_id      INTEGER PRIMARY KEY,
  first_seen       INTEGER NOT NULL,
  chosen_stat      TEXT NOT NULL DEFAULT 'corners',
  watching_fixture INTEGER,
  notify           INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS subscriptions (
  user_id    INTEGER NOT NULL,
  fixture_id INTEGER NOT NULL,
  PRIMARY KEY (user_id, fixture_id)
);

CREATE TABLE IF NOT EXISTS rounds (
  fixture_id     INTEGER NOT NULL,
  open_seq       INTEGER NOT NULL,
  stat           TEXT NOT NULL,
  baseline_value INTEGER NOT NULL,
  status         TEXT NOT NULL DEFAULT 'open',
  actual_value   INTEGER,
  opened_at      INTEGER NOT NULL,
  settled_at     INTEGER,
  PRIMARY KEY (fixture_id, open_seq)
);

CREATE TABLE IF NOT EXISTS guesses (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       INTEGER NOT NULL,
  fixture_id    INTEGER NOT NULL,
  round_seq     INTEGER NOT NULL,
  direction     TEXT NOT NULL,
  committed_at  INTEGER NOT NULL,
  committed_seq INTEGER NOT NULL,
  result        TEXT,
  UNIQUE (user_id, fixture_id, round_seq)
);

CREATE TABLE IF NOT EXISTS streaks (
  user_id INTEGER PRIMARY KEY,
  current INTEGER NOT NULL DEFAULT 0,
  best    INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS seen_events (
  fixture_id INTEGER NOT NULL,
  seq        INTEGER NOT NULL,
  PRIMARY KEY (fixture_id, seq)
);
`;

export class Store {
  private db: Database.Database;

  constructor(path: string = DEFAULT_DB_PATH) {
    mkdirSync(dirname(path), { recursive: true });
    this.db = new Database(path);
    this.db.pragma("journal_mode = WAL");
    this.db.exec(SCHEMA);
    log.info("Store ready", { path });
  }

  // ---- users & subscriptions -------------------------------------------

  upsertUser(telegramId: number): void {
    this.db
      .prepare(
        `INSERT INTO users (telegram_id, first_seen) VALUES (?, ?)
         ON CONFLICT(telegram_id) DO NOTHING`
      )
      .run(telegramId, Date.now());
    this.db
      .prepare(`INSERT INTO streaks (user_id) VALUES (?) ON CONFLICT DO NOTHING`)
      .run(telegramId);
  }

  getChosenStat(telegramId: number): string {
    const row = this.db
      .prepare(`SELECT chosen_stat FROM users WHERE telegram_id = ?`)
      .get(telegramId) as { chosen_stat: string } | undefined;
    return row?.chosen_stat ?? "corners";
  }

  /** Follow a fixture: set it as the game context and subscribe to its events. */
  watchFixture(telegramId: number, fixtureId: number): void {
    this.upsertUser(telegramId);
    this.db
      .prepare(`UPDATE users SET watching_fixture = ? WHERE telegram_id = ?`)
      .run(fixtureId, telegramId);
    this.db
      .prepare(
        `INSERT INTO subscriptions (user_id, fixture_id) VALUES (?, ?)
         ON CONFLICT DO NOTHING`
      )
      .run(telegramId, fixtureId);
  }

  getWatching(telegramId: number): number | null {
    const row = this.db
      .prepare(`SELECT watching_fixture FROM users WHERE telegram_id = ?`)
      .get(telegramId) as { watching_fixture: number | null } | undefined;
    return row?.watching_fixture ?? null;
  }

  /** Telegram IDs subscribed to a fixture and still opted in to notifications. */
  getSubscribers(fixtureId: number): number[] {
    const rows = this.db
      .prepare(
        `SELECT s.user_id FROM subscriptions s
         JOIN users u ON u.telegram_id = s.user_id
         WHERE s.fixture_id = ? AND u.notify = 1`
      )
      .all(fixtureId) as { user_id: number }[];
    return rows.map((r) => r.user_id);
  }

  unsubscribeAll(telegramId: number): void {
    this.db.prepare(`DELETE FROM subscriptions WHERE user_id = ?`).run(telegramId);
    this.db
      .prepare(`UPDATE users SET watching_fixture = NULL WHERE telegram_id = ?`)
      .run(telegramId);
  }

  // ---- dedupe ledger ----------------------------------------------------

  /** Record (fixture, seq). Returns false if already seen (a replay). */
  markSeen(fixtureId: number, seq: number): boolean {
    const res = this.db
      .prepare(
        `INSERT INTO seen_events (fixture_id, seq) VALUES (?, ?)
         ON CONFLICT DO NOTHING`
      )
      .run(fixtureId, seq);
    return res.changes > 0;
  }

  // ---- the round lock ---------------------------------------------------

  getOpenRound(fixtureId: number): Round | null {
    const row = this.db
      .prepare(
        `SELECT fixture_id, open_seq, stat, baseline_value, status, actual_value
         FROM rounds WHERE fixture_id = ? AND status = 'open'
         ORDER BY open_seq DESC LIMIT 1`
      )
      .get(fixtureId) as
      | {
          fixture_id: number;
          open_seq: number;
          stat: string;
          baseline_value: number;
          status: "open" | "settled";
          actual_value: number | null;
        }
      | undefined;
    if (!row) return null;
    return {
      fixtureId: row.fixture_id,
      openSeq: row.open_seq,
      stat: row.stat,
      baselineValue: row.baseline_value,
      status: row.status,
      actualValue: row.actual_value,
    };
  }

  /** Open a round for guesses "by the next update", baselined at `value`. */
  openRound(fixtureId: number, seq: number, stat: string, value: number): void {
    this.db
      .prepare(
        `INSERT INTO rounds (fixture_id, open_seq, stat, baseline_value, status, opened_at)
         VALUES (?, ?, ?, ?, 'open', ?)
         ON CONFLICT(fixture_id, open_seq) DO NOTHING`
      )
      .run(fixtureId, seq, stat, value, Date.now());
  }

  /**
   * Commit a guess to the currently-open round for a fixture. Rejects if there
   * is no open round or the user already guessed this round. The commit is
   * stamped with the round's open_seq and the server receive time; the client's
   * claimed time is never used.
   */
  commitGuess(
    telegramId: number,
    fixtureId: number,
    direction: Direction
  ): CommitOutcome {
    const round = this.getOpenRound(fixtureId);
    if (!round) return { ok: false, reason: "no_open_round" };
    try {
      this.db
        .prepare(
          `INSERT INTO guesses
             (user_id, fixture_id, round_seq, direction, committed_at, committed_seq)
           VALUES (?, ?, ?, ?, ?, ?)`
        )
        .run(telegramId, fixtureId, round.openSeq, direction, Date.now(), round.openSeq);
      return { ok: true };
    } catch (err) {
      // UNIQUE violation => already guessed this round.
      return { ok: false, reason: "already_guessed" };
    }
  }

  /**
   * Settle the open round for a fixture against `actualValue`, then close it —
   * all in one transaction. Scores every committed guess, updates streaks, and
   * returns the per-user outcomes so the engine can notify them. Returns [] if
   * no round was open. This runs BEFORE the new value is broadcast.
   */
  settleOpenRound(fixtureId: number, actualValue: number): SettledGuess[] {
    const settle = this.db.transaction((): SettledGuess[] => {
      const round = this.getOpenRound(fixtureId);
      if (!round) return [];

      const guesses = this.db
        .prepare(
          `SELECT user_id, direction FROM guesses
           WHERE fixture_id = ? AND round_seq = ? AND result IS NULL`
        )
        .all(fixtureId, round.openSeq) as { user_id: number; direction: Direction }[];

      const outcomes: SettledGuess[] = [];
      for (const g of guesses) {
        const correct = scoreGuess(g.direction, round.baselineValue, actualValue);
        const result: GuessResult = correct ? "correct" : "wrong";
        this.db
          .prepare(
            `UPDATE guesses SET result = ?
             WHERE user_id = ? AND fixture_id = ? AND round_seq = ?`
          )
          .run(result, g.user_id, fixtureId, round.openSeq);

        const streak = this.applyStreak(g.user_id, correct);
        outcomes.push({
          userId: g.user_id,
          direction: g.direction,
          result,
          currentStreak: streak.current,
          bestStreak: streak.best,
        });
      }

      this.db
        .prepare(
          `UPDATE rounds SET status = 'settled', actual_value = ?, settled_at = ?
           WHERE fixture_id = ? AND open_seq = ?`
        )
        .run(actualValue, Date.now(), fixtureId, round.openSeq);

      return outcomes;
    });
    return settle();
  }

  private applyStreak(userId: number, correct: boolean): { current: number; best: number } {
    this.db
      .prepare(`INSERT INTO streaks (user_id) VALUES (?) ON CONFLICT DO NOTHING`)
      .run(userId);
    const row = this.db
      .prepare(`SELECT current, best FROM streaks WHERE user_id = ?`)
      .get(userId) as { current: number; best: number };
    const current = correct ? row.current + 1 : 0;
    const best = Math.max(row.best, current);
    this.db
      .prepare(`UPDATE streaks SET current = ?, best = ? WHERE user_id = ?`)
      .run(current, best, userId);
    return { current, best };
  }

  getStreak(telegramId: number): { current: number; best: number } {
    const row = this.db
      .prepare(`SELECT current, best FROM streaks WHERE user_id = ?`)
      .get(telegramId) as { current: number; best: number } | undefined;
    return row ?? { current: 0, best: 0 };
  }

  close(): void {
    this.db.close();
  }
}

/** Pure scoring predicate — exported so it can be unit-tested directly. */
export function scoreGuess(
  direction: Direction,
  baseline: number,
  actual: number
): boolean {
  return direction === "higher" ? actual > baseline : actual <= baseline;
}
