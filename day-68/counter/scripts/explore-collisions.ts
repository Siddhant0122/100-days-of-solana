import * as anchor from "@anchor-lang/core";
import { Keypair, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { Counter } from "../target/types/counter";

async function main() {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Counter as anchor.Program<Counter>;
  const walletA = provider.wallet.publicKey;
  const walletB = Keypair.generate();

  console.log("Program ID:", program.programId.toBase58());
  console.log("Wallet A:  ", walletA.toBase58());
  console.log("Wallet B:  ", walletB.publicKey.toBase58());

  // Fund walletB and init its counter so its PDA actually holds data on chain.
  const sig = await provider.connection.requestAirdrop(
    walletB.publicKey,
    2 * LAMPORTS_PER_SOL
  );
  const latest = await provider.connection.getLatestBlockhash();
  await provider.connection.confirmTransaction(
    { signature: sig, ...latest },
    "confirmed"
  );
  await program.methods
    .initCounter()
    .accounts({ user: walletB.publicKey })
    .signers([walletB])
    .rpc();

  // (the rest of this lesson's snippets all go here, in order)
    const [pdaA] = PublicKey.findProgramAddressSync(
        [Buffer.from("counter"), walletA.toBuffer()],
        program.programId
    );
    const [pdaB] = PublicKey.findProgramAddressSync(
        [Buffer.from("counter"), walletB.publicKey.toBuffer()],
        program.programId
    );

    console.log("\nPer-user counter PDAs");
    console.log("  Wallet A PDA:", pdaA.toBase58());
    console.log("  Wallet B PDA:", pdaB.toBase58());
    console.log("  Same address?", pdaA.equals(pdaB));

    const [pdaGlobalFromA] = PublicKey.findProgramAddressSync(
        [Buffer.from("counter")],
        program.programId
    );
    const [pdaGlobalFromB] = PublicKey.findProgramAddressSync(
        [Buffer.from("counter")],
        program.programId
    );

    console.log("\nGlobal counter PDA (no wallet in seeds)");
    console.log("  Derived from A's perspective:", pdaGlobalFromA.toBase58());
    console.log("  Derived from B's perspective:", pdaGlobalFromB.toBase58());
    console.log("  Same address?", pdaGlobalFromA.equals(pdaGlobalFromB));

    const variants: [string, Buffer[]][] = [
        ['["counter", walletA]',     [Buffer.from("counter"),   walletA.toBuffer()]],
        ['["counters", walletA]',    [Buffer.from("counters"),  walletA.toBuffer()]],
        ['["counter\\0", walletA]',  [Buffer.from("counter\0"), walletA.toBuffer()]],
        ['["Counter", walletA]',     [Buffer.from("Counter"),   walletA.toBuffer()]],
    ];

    console.log("\nNear-miss seed variants");
    for (const [label, seeds] of variants) {
        const [pda] = PublicKey.findProgramAddressSync(seeds, program.programId);
        console.log(`  ${label.padEnd(28)} -> ${pda.toBase58()}`);
    }

    console.log("\nAttempting to spoof a PDA...");
    try {
    await program.methods
        .increment()
        .accounts({
        counter: pdaB, // Meant to give a error
        user: walletA,
        })
        .rpc();
    console.log("  Spoof succeeded (this should NOT happen)");
    } catch (err) {
    console.log("  Spoof rejected:", (err as Error).message.split("\n")[0]);
    }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});


