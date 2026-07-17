import type { Register } from "../deps.js";
import { log } from "../../lib/log.js";
import { getScoreSnapshot } from "../../feed/index.js";
import { getProofAnchor } from "../../feed/proof.js";
import {
  PARSE_MODE,
  verifyMessage,
  verifyUnavailable,
  guessNoMatch,
} from "../render.js";

/**
 * /verify — show that the current scoreline is TxLINE's own number, backed by a
 * Merkle proof anchored on Solana. Read-only: no transaction, no custody. This
 * is the trust story made concrete, and the one thing that uses TxLINE's hybrid
 * on-chain capability.
 */
export const registerVerify: Register = (bot, { store, engine }) => {
  bot.command("verify", async (ctx) => {
    if (!ctx.from) return;
    const fixtureId = store.getWatching(ctx.from.id);
    if (fixtureId == null) {
      await ctx.reply(guessNoMatch(), { parse_mode: PARSE_MODE });
      return;
    }

    const label = engine.getFixtureLabel(fixtureId);
    await ctx.replyWithChatAction("typing").catch(() => {});
    try {
      const score = await getScoreSnapshot(fixtureId);
      if (!score) {
        await ctx.reply(verifyUnavailable(), { parse_mode: PARSE_MODE });
        return;
      }
      const anchor = await getProofAnchor(fixtureId, score.seq, "1,2");
      await ctx.reply(verifyMessage(label, anchor), {
        parse_mode: PARSE_MODE,
        link_preview_options: { is_disabled: true },
      });
    } catch (err) {
      log.warn("verify failed", { fixtureId, error: String(err) });
      await ctx.reply(verifyUnavailable(), { parse_mode: PARSE_MODE });
    }
  });
};
