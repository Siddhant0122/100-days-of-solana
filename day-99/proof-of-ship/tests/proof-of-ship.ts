import * as anchor from "@anchor-lang/core";
import { assert } from "chai";

describe("proof-of-ship", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.ProofOfShip;

  it("records your capstone on chain", async () => {
    await program.methods
      .ship("Proof of Ship", "Built in public, 100 days straight.")
      .rpc();

    const [recordPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("ship"), provider.wallet.publicKey.toBuffer()],
      program.programId
    );
    const record = await program.account.shipRecord.fetch(recordPda);

    assert.equal(record.projectName, "Proof of Ship");
    assert.equal(
      record.builder.toBase58(),
      provider.wallet.publicKey.toBase58()
    );
  });

  it("only lets each wallet ship once", async () => {
    let rejected = false;
    try {
      await program.methods.ship("Second try", "This should never land").rpc();
    } catch (_err) {
      rejected = true;
    }
    assert.isTrue(rejected, "second ship should have been rejected");
  });
});
