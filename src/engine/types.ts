import type { Direction, GuessResult } from "../store/db.js";
import type { GamePhase } from "../feed/types.js";

/**
 * What the engine emits for the bot to deliver. The engine decides *what* is
 * worth telling a user and *who* should hear it; the bot decides *how* it looks.
 */
export type OutboundMessage =
  | {
      kind: "explanation";
      fixtureId: number;
      toUserIds: number[];
      // Structured context the bot renders into the wire dateline + signal line.
      label: string; // e.g. "Morocco vs France"
      phase: GamePhase;
      seq: number;
      ts: number;
      text: string; // the explanation, already validated
    }
  | {
      kind: "game_result";
      toUserId: number;
      stat: string;
      direction: Direction;
      baseline: number;
      actual: number;
      result: GuessResult;
      currentStreak: number;
      bestStreak: number;
    };
