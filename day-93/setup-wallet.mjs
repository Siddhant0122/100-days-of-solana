import { writeFileSync } from "node:fs";
import { web3 } from "@anchor-lang/core";

const { Connection, Keypair, LAMPORTS_PER_SOL } = web3;

const connection = new Connection("https://api.devnet.solana.com", "confirmed");
const wallet = Keypair.generate();

writeFileSync("agent-wallet.json", JSON.stringify(Array.from(wallet.secretKey)));
console.log("Agent wallet address:", wallet.publicKey.toBase58());

try {
  const signature = await connection.requestAirdrop(wallet.publicKey, 2 * LAMPORTS_PER_SOL);
  const latest = await connection.getLatestBlockhash();
  await connection.confirmTransaction({ signature, ...latest });

  const balance = await connection.getBalance(wallet.publicKey);
  console.log("Funded with", balance / LAMPORTS_PER_SOL, "SOL on devnet");
} catch (error) {
  // Devnet airdrops are frequently rate limited. Do not crash — send the user to the faucet.
  console.error("Airdrop failed:", error.message);
  console.log(
    "Fund the wallet manually at https://faucet.solana.com/ — paste this address:",
    wallet.publicKey.toBase58(),
  );
}

