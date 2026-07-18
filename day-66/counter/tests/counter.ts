import * as anchor from "@anchor-lang/core";
import { Program } from "@anchor-lang/core";
import { Counter } from "../target/types/counter";
import { PublicKey } from "@solana/web3.js";
import { assert } from "chai";

describe("counter with config", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.Counter as Program<Counter>;
  const admin = provider.wallet;

  const [configPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("config")],
    program.programId
  );
  const [counterPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("counter"), admin.publicKey.toBuffer()],
    program.programId
  );

  it("initializes config and a counter, then increments", async () => {
    await program.methods.initConfig().rpc();
    await program.methods.initCounter().rpc();
    await program.methods.increment().rpc();

    const counter = await program.account.counter.fetch(counterPda);
    assert.equal(counter.count.toNumber(), 1);
  });

  it("refuses to increment when paused", async () => {
    await program.methods.setPaused(true).rpc();
    try {
      await program.methods.increment().rpc();
      assert.fail("expected pause error");
    } catch (err: any) {
      assert.include(err.toString(), "Paused");
    }
    await program.methods.setPaused(false).rpc();
  });
});