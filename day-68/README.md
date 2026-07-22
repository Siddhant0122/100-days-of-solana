Try to make two PDAs share an address

Run the same PDA derivation twice and you get the same address. Run it from a different wallet, with the same seeds, and you still get the same address. That can be useful or dangerous, depending on how the seeds were designed.

Your counter program has spent the last three days behaving impeccably. init_counter creates a fresh PDA per wallet, increment only touches your own, and close_counter returns the rent. None of that is an accident. It works because the seeds you picked, [b"counter", user.key().as_ref()], bind the address to the wallet that signs the transaction. Change the seed scheme, and the same program would behave very differently.

Today is the day you poke at the rails. You are going to write a single script that derives a handful of PDAs from your program ID using deliberately chosen seeds, observe which derivations land on the same address and which do not, and then attempt one transaction the runtime is supposed to reject. Nothing here ships. The point is to develop a feel for what the seed array actually controls, so the next time you design a program, you can answer the question "who is allowed to write here?" before you write a line of Rust.

### Steps
1. In your counter project, create a new file at scripts/explore-collisions.ts. The whole script lives inside one async function main() because the default Anchor tsconfig.json targets CommonJS, which does not allow top-level await. We are going to derive PDAs and print them, then attempt one deliberately-broken transaction.
2. Set up the imports and the main shell. Inside main, set up the program, your wallet, and a throwaway second wallet. We need the full Keypair (not just the pubkey) because we will fund it and initialize a counter for it on chain — that way the spoof attempt at the end of the script will fail on the seed constraint rather than on "account not initialized."

>import * as anchor from "@anchor-lang/core";
>import { Keypair, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
>import { Counter } from "../target/types/counter";
>
>async function main() {
>  const provider = anchor.AnchorProvider.env();
>  anchor.setProvider(provider);
>
>  const program = anchor.workspace.Counter as anchor.Program<Counter>;
>  const walletA = provider.wallet.publicKey;
>  const walletB = Keypair.generate();
>
>  console.log("Program ID:", program.programId.toBase58());
>  console.log("Wallet A:  ", walletA.toBase58());
>  console.log("Wallet B:  ", walletB.publicKey.toBase58());
>
>  // Fund walletB and init its counter so its PDA actually holds data on chain.
>  const sig = await provider.connection.requestAirdrop(
>    walletB.publicKey,
>    2 * LAMPORTS_PER_SOL
>  );
>  const latest = await provider.connection.getLatestBlockhash();
>  await provider.connection.confirmTransaction(
>    { signature: sig, ...latest },
>    "confirmed"
>  );
>  await program.methods
>    .initCounter()
>    .accounts({ user: walletB.publicKey })
>    .signers([walletB])
>    .rpc();
>
>  // (the rest of this lesson's snippets all go here, in order)
>}
>
>main().catch((err) => {
>  console.error(err);
>  process.exit(1);
>});

3. Inside main, derive the per-user counter PDA for each wallet using exactly the seeds your program expects. These two addresses must be different. If they were the same, your program would have no way to keep one user’s count from clobbering another’s.

>const [pdaA] = PublicKey.findProgramAddressSync(
>  [Buffer.from("counter"), walletA.toBuffer()],
>  program.programId
>);
>const [pdaB] = PublicKey.findProgramAddressSync(
>  [Buffer.from("counter"), walletB.publicKey.toBuffer()],
>  program.programId
>);
>
>console.log("\nPer-user counter PDAs");
>console.log("  Wallet A PDA:", pdaA.toBase58());
>console.log("  Wallet B PDA:", pdaB.toBase58());
>console.log("  Same address?", pdaA.equals(pdaB));

4. Still inside main, derive a hypothetical “global counter” PDA using only the static seed, with no wallet mixed in. This is the address every caller would land on if you had written your seeds as [b"counter"] instead of [b"counter", user.key().as_ref()].

>const [pdaGlobalFromA] = PublicKey.findProgramAddressSync(
>  [Buffer.from("counter")],
>  program.programId
>);
>const [pdaGlobalFromB] = PublicKey.findProgramAddressSync(
>  [Buffer.from("counter")],
>  program.programId
>);
>
>console.log("\nGlobal counter PDA (no wallet in seeds)");
>console.log("  Derived from A's perspective:", pdaGlobalFromA.toBase58());
>console.log("  Derived from B's perspective:", pdaGlobalFromB.toBase58());
>console.log("  Same address?", pdaGlobalFromA.equals(pdaGlobalFromB));

Save and read the output once. The per-user PDAs differ. The global PDA does not. Same seeds, same program ID, same address, every time, for every caller. If your program used those seeds, only the first wallet to call init_counter would ever own a counter; everyone after that would hit “account already in use” because the system program refuses to create the same address twice.

5. Test a few near-misses. PDAs are deterministic hashes, so a single byte difference in the seeds gives a wildly different address. Try a longer seed, a trailing null byte, and the wrong static label.

>const variants: [string, Buffer[]][] = [
>  ['["counter", walletA]',     [Buffer.from("counter"),   walletA.toBuffer()]],
>  ['["counters", walletA]',    [Buffer.from("counters"),  walletA.toBuffer()]],
>  ['["counter\\0", walletA]',  [Buffer.from("counter\0"), walletA.toBuffer()]],
>  ['["Counter", walletA]',     [Buffer.from("Counter"),   walletA.toBuffer()]],
>];
>
>console.log("\nNear-miss seed variants");
>for (const [label, seeds] of variants) {
>  const [pda] = PublicKey.findProgramAddressSync(seeds, program.programId);
>  console.log(`  ${label.padEnd(28)} -> ${pda.toBase58()}`);
>}

Every line should print a different address. There is no “close enough” in PDA-land. Either the seeds match exactly, or you get a stranger.

6. Now the runtime check. Try to spoof a PDA: from Wallet A, attempt to increment while passing Wallet B’s PDA as the counter account. The program’s #[account(seeds = [b"counter", user.key().as_ref()], bump)] constraint will try to re-derive the address from your signer and confirm it matches the one you supplied. It will not.

>console.log("\nAttempting to spoof a PDA...");
>try {
>  await program.methods
>    .increment()
>    .accounts({
>      counter: pdaB,
>      user: walletA,
>    })
>    .rpc();
>  console.log("  Spoof succeeded (this should NOT happen)");
>} catch (err) {
>  console.log("  Spoof rejected:", (err as Error).message.split("\n")[0]);
>}

###> Set up the cluster
The script talks to a deployed program and expects the config singleton to already exist. Do these three things first, in order.

1. Start a local validator and leave it running in its own terminal:

>solana-test-validator

2. Deploy the program to it from the project root:
>anchor deploy

3. Initialize the config once. Create scripts/init-config.ts:

>import * as anchor from "@anchor-lang/core";
>import { Counter } from "../target/types/counter";
>
>(async () => {
>  const provider = anchor.AnchorProvider.env();
>  anchor.setProvider(provider);
>  const program = anchor.workspace.Counter as anchor.Program<Counter>;
>  await program.methods.initConfig().rpc();
>  console.log("config initialized");
>})();

### Run it once:
>ANCHOR_PROVIDER_URL="http://127.0.0.1:8899" ANCHOR_WALLET="$HOME/.config/solana/id.json" \
>  npx ts-node --transpile-only scripts/init-config.ts

If the config already exists from an earlier run, the call fails with a Simulation failed. message and an already in use line in the program logs — that is fine, it means the singleton is already there. Move on.

### Run it
Invoke ts-node directly — Anchor’s template already pulls it in transitively through ts-mocha. The --transpile-only flag skips whole-program type checking, which is what we want here because the default Anchor tsconfig.json only declares mocha and chai types and will otherwise complain about Buffer and console:

>ANCHOR_PROVIDER_URL="http://127.0.0.1:8899" ANCHOR_WALLET="$HOME/.config/solana/id.json" \
>  npx ts-node --transpile-only scripts/explore-collisions.ts

Unlike anchor test and anchor run, invoking ts-node directly means nothing sets up the Anchor provider for you, so AnchorProvider.env() reads the cluster URL and wallet from these two environment variables. Without them you get ANCHOR_PROVIDER_URL is not defined. The URL points at the local validator from the prerequisites above (use your devnet URL instead if that is where you deployed).

If you get Cannot find module .../target/types/counter, check that package.json does not have "type": "module". That setting switches ts-node to the ESM loader, which rejects the script’s extensionless relative import. Remove it and the script runs.

You watched a seed array behave like a database compound key. [b"counter", user.key().as_ref()] is effectively (table_name, user_id), and just like a relational unique index, it carves the address space into one row per user. Drop the user from the seeds and you get one global row that every caller competes for, with the system program acting as the bouncer who lets exactly one wallet through the door. PDAs do not have collisions in the cryptographic sense; sha256 makes engineering two distinct seed inputs to the same address infeasible. The collisions that actually hurt you are the ones you write on purpose by leaving identity out of the seeds and only noticing once the second user complains.

The spoof attempt is the other half of the lesson. Anchor’s seeds and bump constraints are not just for derivation, they are also a verifier. When Wallet A passed Wallet B’s PDA into increment, Anchor re-derived the expected address from Wallet A’s signer and compared it to what you sent. The mismatch produced a ConstraintSeeds error before any business logic ran. That check is the reason your counter program can trust the account it was handed without a manual ownership lookup.

You did not change a single line of on-chain code today. You only changed what you asked the derivation function for, and you learned more about the program’s safety surface than you would have by writing another instruction.

