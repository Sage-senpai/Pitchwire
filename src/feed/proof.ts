import { Connection, PublicKey, Keypair, ComputeBudgetProgram } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import BN from "bn.js";
import { readFileSync } from "node:fs";
import { config } from "../config.js";
import { log } from "../lib/log.js";
import { txlineHttp } from "./client.js";

/**
 * The trust story, made real and cryptographic. TxLINE is hybrid: the data is
 * off-chain, but a daily Merkle root of every score is anchored on Solana. So a
 * scoreline comes with a Merkle proof that resolves to that on-chain root.
 *
 * We fetch the proof from `/scores/stat-validation` and run the program's
 * `validate_stat_v2` as a read-only `.view()` — a simulation, no transaction, no
 * signing cost, no custody. The program verifies the proof against the on-chain
 * root and returns a boolean. A correct scoreline verifies true; a tampered one
 * verifies false. This is the settlement primitive used for on-chain trades,
 * turned toward pure honest verification — we don't trade, we prove.
 *
 * The read-only simulation still needs an existing account as fee payer, so it
 * uses our own devnet service wallet (the same one that signed `subscribe`). If
 * that key isn't present at runtime, we degrade to surfacing the proof + its
 * on-chain anchor without the boolean.
 */

const PROGRAM_ID = new PublicKey("6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J");
const DAILY_SCORES_ROOTS_SEED = "daily_scores_roots";
const MS_PER_DAY = 86_400_000;

const idl = JSON.parse(
  readFileSync(new URL("./txoracle.idl.json", import.meta.url), "utf8")
) as anchor.Idl;

let conn: Connection | null = null;
function connection(): Connection {
  conn ??= new Connection(config.SOLANA_RPC_URL, "confirmed");
  return conn;
}

// Program bound to the funded service wallet (fee payer for the view sim only).
let program: anchor.Program | null = null;
function getProgram(): anchor.Program | null {
  if (program) return program;
  if (!config.SERVICE_WALLET_SECRET) return null;
  try {
    const kp = Keypair.fromSecretKey(
      anchor.utils.bytes.bs58.decode(config.SERVICE_WALLET_SECRET.trim())
    );
    const provider = new anchor.AnchorProvider(
      connection(),
      new anchor.Wallet(kp),
      anchor.AnchorProvider.defaultOptions()
    );
    program = new anchor.Program(idl, provider);
    log.info("proof: on-chain verification ready", { feePayer: kp.publicKey.toBase58() });
    return program;
  } catch (err) {
    log.warn("proof: could not init verification program", { error: String(err) });
    return null;
  }
}

function bytesToHex(bytes: number[] | Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function dailyScoresRootPda(epochDay: number): PublicKey {
  const seed = Buffer.alloc(2);
  seed.writeUInt16LE(epochDay);
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from(DAILY_SCORES_ROOTS_SEED), seed],
    PROGRAM_ID
  );
  return pda;
}

// Map the API proof array to the exact ProofNode shape Anchor expects.
function mapProof(nodes: { hash: number[]; isRightSibling: boolean }[]): {
  hash: number[];
  isRightSibling: boolean;
}[] {
  return nodes.map((n) => ({ hash: Array.from(n.hash), isRightSibling: n.isRightSibling }));
}

interface StatValidationResponse {
  ts: number;
  statsToProve: { key: number; value: number; period: number }[];
  eventStatRoot: number[];
  summary: {
    fixtureId: number;
    updateStats: { updateCount: number; minTimestamp: number; maxTimestamp: number };
    eventStatsSubTreeRoot: number[];
  };
  statProofs: { hash: number[]; isRightSibling: boolean }[][];
  subTreeProof: { hash: number[]; isRightSibling: boolean }[];
  mainTreeProof: { hash: number[]; isRightSibling: boolean }[];
}

export interface ProofAnchor {
  fixtureId: number;
  seq: number;
  epochDay: number;
  stats: { key: number; value: number }[];
  eventStatRootHex: string;
  dailyRootPda: string;
  onChain: boolean;
  /** true = cryptographically verified on-chain; false = failed; null = couldn't run. */
  verified: boolean | null;
  explorerUrl: string;
}

/**
 * Fetch the Merkle proof for a fixture's goals at a sequence, confirm the day's
 * root is anchored on-chain, and — if the service wallet is present — run the
 * on-chain `validate_stat_v2` view to cryptographically verify the scoreline.
 */
export async function getProofAnchor(
  fixtureId: number,
  seq: number
): Promise<ProofAnchor> {
  const res = await txlineHttp.get("/scores/stat-validation", {
    params: { fixtureId, seq, statKeys: "1,2" },
  });
  const val = res.data as StatValidationResponse;

  const ts = val.summary.updateStats.minTimestamp;
  const epochDay = Math.floor(ts / MS_PER_DAY);
  const pda = dailyScoresRootPda(epochDay);
  const stats = (val.statsToProve ?? []).map((s) => ({ key: s.key, value: s.value }));

  const info = await connection().getAccountInfo(pda);
  const onChain = info != null && info.owner.equals(PROGRAM_ID);

  const verified = await verifyOnChain(val, epochDay, pda).catch((err) => {
    log.warn("proof: on-chain view failed", { fixtureId, seq, error: String(err) });
    return null;
  });

  return {
    fixtureId,
    seq,
    epochDay,
    stats,
    eventStatRootHex: val.eventStatRoot ? bytesToHex(val.eventStatRoot) : "",
    dailyRootPda: pda.toBase58(),
    onChain,
    verified,
    explorerUrl: `https://explorer.solana.com/address/${pda.toBase58()}?cluster=devnet`,
  };
}

/**
 * Run `validate_stat_v2` as a read-only view: verify the Merkle proof against the
 * on-chain daily root and assert the home-goals value equals what the feed shows.
 * Returns true (verified), false (mismatch), or null (no service wallet).
 */
async function verifyOnChain(
  val: StatValidationResponse,
  epochDay: number,
  pda: PublicKey
): Promise<boolean | null> {
  const prog = getProgram();
  if (!prog || val.statsToProve.length === 0) return null;

  const payload = {
    ts: new BN(val.summary.updateStats.minTimestamp),
    fixtureSummary: {
      fixtureId: new BN(val.summary.fixtureId),
      updateStats: {
        updateCount: val.summary.updateStats.updateCount,
        minTimestamp: new BN(val.summary.updateStats.minTimestamp),
        maxTimestamp: new BN(val.summary.updateStats.maxTimestamp),
      },
      eventsSubTreeRoot: Array.from(val.summary.eventStatsSubTreeRoot),
    },
    fixtureProof: mapProof(val.subTreeProof),
    mainTreeProof: mapProof(val.mainTreeProof),
    eventStatRoot: Array.from(val.eventStatRoot),
    // Verify a single stat leaf (home goals). The multi-stat view wants a
    // predicate per stat; one leaf is enough to prove the proof resolves to the
    // on-chain root, which is what authenticates the number.
    stats: [{ stat: val.statsToProve[0], statProof: mapProof(val.statProofs[0]) }],
  };

  // Assert stat[0] (home goals) equals the reported value. A true result means
  // the proof verified against the on-chain root AND the value is as claimed.
  const strategy = {
    geometricTargets: [],
    distancePredicate: null,
    discretePredicates: [
      {
        single: {
          index: 0,
          predicate: { threshold: val.statsToProve[0].value, comparison: { equalTo: {} } },
        },
      },
    ],
  };

  const computeBudget = ComputeBudgetProgram.setComputeUnitLimit({ units: 1_400_000 });
  const methods = prog.methods as unknown as {
    validateStatV2: (p: unknown, s: unknown) => {
      accounts: (a: unknown) => {
        preInstructions: (ix: unknown[]) => { view: () => Promise<boolean> };
      };
    };
  };
  return methods
    .validateStatV2(payload, strategy)
    .accounts({ dailyScoresMerkleRoots: pda })
    .preInstructions([computeBudget])
    .view();
}
