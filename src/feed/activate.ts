/**
 * ONE-TIME setup: subscribe on-chain (devnet, free World Cup tier) and activate
 * the API token. Run once with a funded devnet service wallet:
 *
 *   solana airdrop 2 <WALLET_PUBKEY> --url https://api.devnet.solana.com
 *   npm run activate
 *
 * It prints the API token — paste it into .env as TXLINE_API_TOKEN. The token
 * does not expire, so the running bot never needs to repeat this.
 *
 * This is the ONLY on-chain action in the whole project. It signs one devnet
 * `subscribe` transaction with our own service wallet. It never touches, holds,
 * or moves any user's funds. (See CLAUDE.md hard boundaries.)
 *
 * The subscribe account list, PDA seeds, and the `${txSig}::${jwt}` activation
 * message are taken verbatim from the TxLINE devnet / World Cup docs.
 */
import * as anchor from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import nacl from "tweetnacl";
import axios from "axios";
import { readFileSync } from "node:fs";
import { config } from "../config.js";
import { guestStartUrl, apiBaseUrl } from "./auth.js";
import { log } from "../lib/log.js";

// Devnet program + token mint (from the TxLINE devnet program reference).
const PROGRAM_ID = new PublicKey("6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J");
const TXL_TOKEN_MINT = new PublicKey("4Zao8ocPhmMgq7PdsYWyxvqySMGx7xb9cMftPMkEokRG");

// Free World Cup tier parameters.
const SERVICE_LEVEL_ID = 1;
const DURATION_WEEKS = 4;
const SELECTED_LEAGUES: number[] = []; // empty = standard bundle

function loadWallet(): Keypair {
  if (!config.SERVICE_WALLET_SECRET) {
    throw new Error("SERVICE_WALLET_SECRET is not set in .env");
  }
  const secret = anchor.utils.bytes.bs58.decode(config.SERVICE_WALLET_SECRET.trim());
  return Keypair.fromSecretKey(secret);
}

async function loadIdl(provider: anchor.AnchorProvider): Promise<anchor.Idl> {
  // Prefer the on-chain published IDL so we don't ship a possibly-stale copy.
  const onChain = await anchor.Program.fetchIdl(PROGRAM_ID, provider);
  if (onChain) return onChain;

  // Fallback: a local IDL JSON (place it here if the program has no on-chain IDL).
  const path = process.env.TXLINE_IDL_PATH ?? "idl/txline_devnet.json";
  log.warn(`No on-chain IDL; loading from ${path}`);
  const idl = JSON.parse(readFileSync(path, "utf8")) as anchor.Idl;
  (idl as { address?: string }).address ??= PROGRAM_ID.toBase58();
  return idl;
}

async function subscribeOnChain(
  program: anchor.Program,
  wallet: Keypair
): Promise<string> {
  const [tokenTreasuryPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("token_treasury_v2")],
    program.programId
  );
  const [pricingMatrixPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("pricing_matrix")],
    program.programId
  );

  const userTokenAccount = getAssociatedTokenAddressSync(
    TXL_TOKEN_MINT,
    wallet.publicKey,
    false,
    TOKEN_2022_PROGRAM_ID
  );
  const tokenTreasuryVault = getAssociatedTokenAddressSync(
    TXL_TOKEN_MINT,
    tokenTreasuryPda,
    true, // PDA owner is off-curve
    TOKEN_2022_PROGRAM_ID
  );

  log.info("Sending subscribe transaction (devnet)…");
  const txSig = await (program.methods as anchor.Program["methods"])
    .subscribe(SERVICE_LEVEL_ID, DURATION_WEEKS)
    .accounts({
      user: wallet.publicKey,
      pricingMatrix: pricingMatrixPda,
      tokenMint: TXL_TOKEN_MINT,
      userTokenAccount,
      tokenTreasuryVault,
      tokenTreasuryPda,
      tokenProgram: TOKEN_2022_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  log.info("Subscribed on-chain", { txSig });
  return txSig;
}

async function activateToken(txSig: string, wallet: Keypair): Promise<string> {
  // 1. guest JWT
  const auth = await axios.post(guestStartUrl, {});
  const jwt: string = auth.data?.token ?? auth.data;
  if (!jwt) throw new Error("guest/start returned no token");

  // 2. sign the activation message. For SELECTED_LEAGUES = [] it is `${txSig}::${jwt}`.
  const messageString = `${txSig}:${SELECTED_LEAGUES.join(",")}:${jwt}`;
  const message = new TextEncoder().encode(messageString);
  const signatureBytes = nacl.sign.detached(message, wallet.secretKey);
  const walletSignature = Buffer.from(signatureBytes).toString("base64");

  // 3. activate
  const activation = await axios.post(
    `${apiBaseUrl}/token/activate`,
    { txSig, walletSignature, leagues: SELECTED_LEAGUES },
    { headers: { Authorization: `Bearer ${jwt}` } }
  );
  const apiToken: string = activation.data?.token ?? activation.data;
  if (!apiToken) throw new Error("token/activate returned no token");
  return apiToken;
}

async function main(): Promise<void> {
  const wallet = loadWallet();
  log.info("Service wallet loaded", { pubkey: wallet.publicKey.toBase58() });

  const connection = new Connection(config.SOLANA_RPC_URL, "confirmed");
  const provider = new anchor.AnchorProvider(connection, new anchor.Wallet(wallet), {
    commitment: "confirmed",
  });

  const idl = await loadIdl(provider);
  const program = new anchor.Program(idl, provider);

  const txSig = await subscribeOnChain(program, wallet);
  const apiToken = await activateToken(txSig, wallet);

  console.log("\n=== TxLINE activation complete ===");
  console.log("Add this to your .env:\n");
  console.log(`TXLINE_API_TOKEN=${apiToken}\n`);
}

main().catch((err) => {
  const detail = axios.isAxiosError(err)
    ? `${err.response?.status} ${JSON.stringify(err.response?.data)}`
    : String(err);
  log.error("Activation failed", { detail });
  console.error(
    "\nActivation failed. Common causes: wallet not funded with devnet SOL, " +
      "network/host mismatch, or an already-active subscription. See " +
      "docs/02-txline-reference.md."
  );
  process.exit(1);
});
