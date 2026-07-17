import { Connection, PublicKey } from "@solana/web3.js";
import { config } from "../config.js";
import { txlineHttp } from "./client.js";

/**
 * The trust story, made real. TxLINE is hybrid: the data lives off-chain, but a
 * daily Merkle root of every score is anchored on Solana. So any scoreline comes
 * with a cryptographic proof that resolves to a root stored on-chain.
 *
 * This module fetches that proof for a stat and reads the on-chain daily-root
 * account that backs it. It is READ-ONLY — no transaction, no signing, no
 * custody. It reinforces Pitchwire's boundary: we read and explain, and here we
 * can show the read is provably TxLINE's own number, not ours.
 *
 * (Full in-app Merkle re-computation / the program's `validate_stat` view is the
 * settlement path for on-chain trades; we deliberately don't do trades, so we
 * surface the proof + its on-chain anchor rather than re-deriving the tree.)
 */

const PROGRAM_ID = new PublicKey("6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J");
const DAILY_SCORES_ROOTS_SEED = "daily_scores_roots";
const MS_PER_DAY = 86_400_000;

let conn: Connection | null = null;
function connection(): Connection {
  conn ??= new Connection(config.SOLANA_RPC_URL, "confirmed");
  return conn;
}

function bytesToHex(bytes: number[] | Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function epochDayOf(ts: number): number {
  return Math.floor(ts / MS_PER_DAY);
}

/** Derive the PDA that stores the day's on-chain scores Merkle root. */
export function dailyScoresRootPda(epochDay: number): PublicKey {
  const seed = Buffer.alloc(2);
  seed.writeUInt16LE(epochDay);
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from(DAILY_SCORES_ROOTS_SEED), seed],
    PROGRAM_ID
  );
  return pda;
}

export interface ProofAnchor {
  fixtureId: number;
  seq: number;
  ts: number;
  epochDay: number;
  stats: { key: number; value: number }[];
  eventStatRootHex: string;
  dailyRootPda: string;
  onChain: boolean;
  rootAccountBytes: number;
  explorerUrl: string;
}

/**
 * Fetch the Merkle proof for a fixture's stats at a sequence, then confirm the
 * day's root it resolves to is anchored on-chain. Throws on API/RPC failure so
 * the caller can degrade gracefully.
 */
export async function getProofAnchor(
  fixtureId: number,
  seq: number,
  statKeys = "1,2"
): Promise<ProofAnchor> {
  const res = await txlineHttp.get("/scores/stat-validation", {
    params: { fixtureId, seq, statKeys },
  });
  const data = res.data as {
    ts: number;
    statsToProve?: { key: number; value: number }[];
    eventStatRoot?: number[];
  };
  const ts = data.ts;
  const epochDay = epochDayOf(ts);
  const eventStatRootHex = data.eventStatRoot ? bytesToHex(data.eventStatRoot) : "";
  const stats = (data.statsToProve ?? []).map((s) => ({ key: s.key, value: s.value }));

  const pda = dailyScoresRootPda(epochDay);
  const info = await connection().getAccountInfo(pda);

  return {
    fixtureId,
    seq,
    ts,
    epochDay,
    stats,
    eventStatRootHex,
    dailyRootPda: pda.toBase58(),
    onChain: info != null && info.owner.equals(PROGRAM_ID),
    rootAccountBytes: info?.data.length ?? 0,
    explorerUrl: `https://explorer.solana.com/address/${pda.toBase58()}?cluster=devnet`,
  };
}
