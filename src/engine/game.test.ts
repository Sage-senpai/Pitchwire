import assert from "node:assert/strict";
import { Store, scoreGuess } from "../store/db.js";
import { statValue } from "./game.js";
import type { DecodedStat } from "../feed/types.js";

/**
 * Unit test for the un-gameable round lock. This is the one place mocking is
 * correct — we script a sequence of fake events to prove the lock, not to ship
 * mocked data. Run with `npm run test:game`.
 */

let passed = 0;
function check(name: string, fn: () => void): void {
  try {
    fn();
    passed++;
    console.log(`  ok  ${name}`);
  } catch (err) {
    console.error(`FAIL  ${name}\n      ${(err as Error).message}`);
    process.exitCode = 1;
  }
}

const FX = 9001;

// --- pure scoring ---------------------------------------------------------
check("scoreGuess: higher wins when actual > baseline", () => {
  assert.equal(scoreGuess("higher", 3, 4), true);
  assert.equal(scoreGuess("higher", 3, 3), false);
});
check("scoreGuess: same_or_lower wins when actual <= baseline", () => {
  assert.equal(scoreGuess("same_or_lower", 3, 3), true);
  assert.equal(scoreGuess("same_or_lower", 3, 4), false);
});

// --- statValue mapping ----------------------------------------------------
check("statValue: corners = base 7 + base 8 totals", () => {
  const stats: DecodedStat[] = [
    { key: 7, base: 7, period: 0, periodLabel: "total", label: "", participant: 1, value: 5 },
    { key: 8, base: 8, period: 0, periodLabel: "total", label: "", participant: 2, value: 3 },
  ];
  assert.equal(statValue(stats, "corners"), 8);
});

// --- the round lock -------------------------------------------------------
const store = new Store(":memory:");

check("commit to a closed round is rejected", () => {
  // Round opened at seq 1, corners baseline 3.
  store.openRound(FX, 1, "corners", 3);
  assert.equal(store.commitGuess(1001, FX, "higher").ok, true);

  // One guess per user per round.
  assert.equal(store.commitGuess(1001, FX, "higher").reason, "already_guessed");

  assert.equal(store.commitGuess(1002, FX, "same_or_lower").ok, true);

  // Feed emits the next update: corners now 4. Settle closes the round.
  const outcomes = store.settleOpenRound(FX, 4);
  const a = outcomes.find((o) => o.userId === 1001);
  const b = outcomes.find((o) => o.userId === 1002);
  assert.equal(a?.result, "correct", "higher wins 3->4");
  assert.equal(a?.currentStreak, 1);
  assert.equal(b?.result, "wrong", "same_or_lower loses 3->4");
  assert.equal(b?.currentStreak, 0);

  // Round is now settled — a late guess to that round cannot be committed.
  const late = store.commitGuess(1003, FX, "higher");
  assert.equal(late.ok, false);
  assert.equal(late.reason, "no_open_round");
});

check("streak resets on a wrong guess", () => {
  // New round at seq 2, baseline 4. User 1001 (streak 1) guesses higher.
  store.openRound(FX, 2, "corners", 4);
  assert.equal(store.commitGuess(1001, FX, "higher").ok, true);
  // Corners stay at 4 — higher loses.
  const outcomes = store.settleOpenRound(FX, 4);
  const a = outcomes.find((o) => o.userId === 1001);
  assert.equal(a?.result, "wrong");
  assert.equal(a?.currentStreak, 0, "streak reset");
  assert.equal(a?.bestStreak, 1, "best is retained");
});

check("settling with no open round is a no-op", () => {
  assert.deepEqual(store.settleOpenRound(FX, 9), []);
});

store.close();

console.log(`\n${passed} checks passed.`);
if (process.exitCode) console.error("Some checks FAILED.");
