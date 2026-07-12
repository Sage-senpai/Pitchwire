import type { Bot } from "grammy";
import type { Store } from "../store/db.js";
import type { Engine } from "../engine/index.js";

/** Shared dependencies handed to every command module. */
export interface BotDeps {
  store: Store;
  engine: Engine;
}

/** Each command module registers its handlers on the bot. */
export type Register = (bot: Bot, deps: BotDeps) => void;
