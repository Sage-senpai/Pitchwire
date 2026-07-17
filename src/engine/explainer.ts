import Anthropic from "@anthropic-ai/sdk";
import { config } from "../config.js";
import { log } from "../lib/log.js";

/**
 * The explanation layer — the product. It turns a decoded, significant change
 * into one or two sentences a fan understands, in Pitchwire's voice, grounded
 * ONLY in what the feed actually said.
 *
 * Hard constraints (from CLAUDE.md, encoded in the system prompt AND enforced
 * after generation): never advises a bet, never invents facts, never hypes.
 * If the model output is empty, too long, or trips the banned-phrase guard, we
 * fall back to a plain templated sentence built from the decoded data. We never
 * send unreviewed model text to a user during a live match.
 */

// Constructed lazily: the setup scripts import this module's siblings without an
// Anthropic key, and an absent key must degrade to the template, never throw.
let client: Anthropic | null = null;
function getClient(): Anthropic | null {
  if (!config.ANTHROPIC_API_KEY) return null;
  client ??= new Anthropic({ apiKey: config.ANTHROPIC_API_KEY });
  return client;
}

const SYSTEM_PROMPT = `You are Pitchwire, a live World Cup wire. You read a match and the betting market and report what just changed, like a telegraph operator who happens to know the data cold.

Voice: clipped, certain, never padded. Short declaratives. Present tense, active voice. Confident but never hyped.

Absolute rules:
- Report only what the input states. Never invent a scoreline, a player, a minute, or a market number that is not given to you.
- Mention the betting market ONLY when the input gives you an explicit "Market:" line. If there is no market data in the input, do not mention the market, the odds, or what the market thinks in any way. Just report the on-pitch event. Do not speculate about how the market might react.
- You describe what the data shows and what the market is doing. You NEVER advise anyone to place a bet, back a team, or stake anything. Never use "bet", "back", "tip", "lock", "value", "guaranteed", or "sure thing".
- No hype. No "HUGE", no "massive", no exclamation stacks.
- One or two sentences. No preamble, no reasoning, no sign-off. Output only the sentences a fan reads.`;

// Anything betting-adjacent or hyped => reject and use the template instead.
const BANNED = [
  /\bbet\b/i,
  /\bbets\b/i,
  /\bbetting\b/i,
  /\bback (it|them|the|morocco|france|[a-z]+)\b/i,
  /\bwager/i,
  /\bstake\b/i,
  /\btip\b/i,
  /\block\b/i,
  /\bguaranteed\b/i,
  /\bsure thing\b/i,
  /\bvalue\b/i,
  /\bhuge\b/i,
  /\bmassive\b/i,
];

const MAX_LEN = 320;

export interface ExplainInput {
  label: string; // "Morocco vs France"
  homeName: string;
  awayName: string;
  scoreLine: string; // "Morocco 1 - 0 France"
  phaseLabel: string; // "second half"
  fact: string; // the significant change, plain
  oddsFact?: string; // optional market movement, plain
}

/** Validate model output; return the text if clean, else null. */
function validate(text: string, hasMarketData: boolean): string | null {
  const t = text.trim();
  if (!t) return null;
  if (t.length > MAX_LEN) return null;
  if (BANNED.some((re) => re.test(t))) {
    log.warn("Explainer output tripped banned-phrase guard; using fallback");
    return null;
  }
  // Never let the model invent market commentary when no odds were provided.
  // Reporting on "the market" with no market input is a fabricated signal.
  if (!hasMarketData && /\b(market|odds)\b/i.test(t)) {
    log.warn("Explainer invented market talk with no odds data; using fallback");
    return null;
  }
  return t;
}

/** Deterministic fallback: always accurate, always in-boundary. */
export function templatedExplanation(input: ExplainInput): string {
  const parts = [input.fact];
  if (input.oddsFact) parts.push(input.oddsFact);
  return parts.join(" ");
}

function buildUserPrompt(input: ExplainInput): string {
  const lines = [
    `Match: ${input.label} (neutral venue).`,
    `Score: ${input.scoreLine}.`,
    `Phase: ${input.phaseLabel}.`,
    `What just changed: ${input.fact}`,
  ];
  if (input.oddsFact) {
    lines.push(`Market: ${input.oddsFact}`);
    lines.push(
      "Write one or two sentences: what happened on the pitch, and what the market move signals."
    );
  } else {
    lines.push("No market data provided.");
    lines.push(
      "Write one or two sentences on what just happened on the pitch. Do not mention the market or odds at all."
    );
  }
  return lines.join("\n");
}

export async function explain(input: ExplainInput): Promise<string> {
  const anthropic = getClient();
  if (!anthropic) return templatedExplanation(input);
  try {
    const res = await anthropic.messages.create({
      model: config.EXPLAINER_MODEL,
      max_tokens: 200,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildUserPrompt(input) }],
    });
    const text = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
    const clean = validate(text, Boolean(input.oddsFact));
    if (clean) return clean;
  } catch (err) {
    log.warn("Explainer LLM call failed; using fallback", { error: String(err) });
  }
  return templatedExplanation(input);
}
