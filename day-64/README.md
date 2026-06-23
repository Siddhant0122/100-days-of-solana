## Derive your first PDA from seeds

Every address you have generated on Solana so far has had a private key sitting somewhere on your machine. The address you derive in the next twenty minutes does not, and that single difference is the entire reason your programs can own state.

You spent the last arc building a counter program in Anchor. It compiled, it ran, it refused the wrong wallet, and your tests went green. There is one thing it could not do, and the gap has been bugging you: it can only store state in an account whose keypair you generated yourself and passed in from the client. That works as we start. It does not work for a real application where you want one counter per user, or one vault per token, or one game per match, derived from inputs your program already knows about.

The Solana answer to this is a Program Derived Address. A PDA is a public key that lives off the ed25519 curve, which means no private key produces it, which means no human can sign for it. Instead, the program it belongs to can sign for it on demand. Today you are not going to use one in a program yet. You are going to derive one in a script, print it to the terminal, and look at it until the mechanic stops feeling magical and starts feeling like a hash function with one extra rule. Tomorrow you will use what you derive today to give every user their own counter account.

### Steps
1. Open Anchor.toml and copy the program ID under [programs.localnet]. This is the same public key declared in declare_id! inside your lib.rs. Both must match for any of this to work.
2. From the project root, create a new file called scripts/derive-pda.ts.
3. Paste the script below into that file, then replace YOUR_PROGRAM_ID_HERE with the program ID you copied:
>import { PublicKey } from "@solana/web3.js";
>
>const programId = new PublicKey("YOUR_PROGRAM_ID_HERE");
>
>const [pda, bump] = PublicKey.findProgramAddressSync(
>  [Buffer.from("counter")],
>  programId
>);
>
>console.log("Seeds:        [\"counter\"]");
>console.log("Program ID:   ", programId.toBase58());
>console.log("PDA:          ", pda.toBase58());
>console.log("Canonical bump:", bump);

4. Read the script before you run it. The seed is a single byte string, "counter". The function findProgramAddressSync hashes your seeds together with the program ID and a one-byte bump value, starting at 255 and counting down, until the hashed result lands at a point that is not on the ed25519 curve. The first bump that produces an off-curve address is the canonical bump, and that is the one returned.
5. Run the script with the command below and confirm the output:
>npx ts-node --transpile-only scripts/derive-pda.ts

You should see a base58 PDA and a bump between 0 and 255. Roughly three out of four runs will give you 254 or 255 for a short seed list, with lower values like 252 or 253 showing up the rest of the time, because each candidate bump has about a fifty-fifty chance of landing on the curve.

6. Now change the seed. Edit the file so the seeds line reads:

>  [Buffer.from("counter"), Buffer.from("alice")],

Run the script again. The PDA is completely different. The bump may also differ.

7. Change the second seed from "alice" to "bob" and run a third time. Different PDA again. Same program ID, same first seed, but a different namespace.
8. Finally, restore the seeds to just [Buffer.from("counter")], run the script a fourth time, and verify that the address matches your first run byte for byte. Determinism is the entire point.

Run it
>npx ts-node --transpile-only scripts/derive-pda.ts

The --transpile-only flag tells ts-node to skip whole-program type checking and just run the file. Without it, the default Anchor tsconfig.json (which only pulls in mocha and chai types) will complain that Buffer and console are not defined.

