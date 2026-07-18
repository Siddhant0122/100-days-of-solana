import * as anchor from "@anchor-lang/core";
import { Program } from "@anchor-lang/core";
import { Counter } from "../target/types/counter";
import { PublicKey, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { assert } from "chai";

describe("counter", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.Counter as Program<Counter>;

  const counterPda = (user: PublicKey) =>
    PublicKey.findProgramAddressSync(
      [Buffer.from("counter"), user.toBuffer()],
      program.programId
    )[0];

  it("creates a counter per user and increments independently", async () => {
    const alice = provider.wallet.publicKey;
    const bob = Keypair.generate();

    // fund bob so he can pay rent
    const sig = await provider.connection.requestAirdrop(
      bob.publicKey,
      2 * LAMPORTS_PER_SOL
    );
    const latest = await provider.connection.getLatestBlockhash();
    await provider.connection.confirmTransaction({ signature: sig, ...latest }, "confirmed");

    await program.methods
      .initCounter()
      .accounts({ user: alice })
      .rpc();

    await program.methods
      .initCounter()
      .accounts({ user: bob.publicKey })
      .signers([bob])
      .rpc();

    await program.methods.increment().accounts({ user: alice }).rpc();
    await program.methods.increment().accounts({ user: alice }).rpc();
    await program.methods.increment().accounts({ user: bob.publicKey }).signers([bob]).rpc();

    const aliceState = await program.account.counter.fetch(counterPda(alice));
    const bobState = await program.account.counter.fetch(counterPda(bob.publicKey));

    assert.equal(aliceState.count.toNumber(), 2);
    assert.equal(bobState.count.toNumber(), 1);
    assert.ok(aliceState.user.equals(alice));
    assert.ok(bobState.user.equals(bob.publicKey));
  });
});