import * as anchor from "@anchor-lang/core";
import { Program, web3 } from "@anchor-lang/core";
import { SolMover } from "../target/types/sol_mover";

const { Keypair, LAMPORTS_PER_SOL } = web3;

describe("sol-mover", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.SolMover as Program<SolMover>;
  const sender = provider.wallet;

  it("moves SOL with a CPI to the System Program", async () => {
    const recipient = Keypair.generate();
    const amount = new anchor.BN(0.25 * LAMPORTS_PER_SOL);

    const before = await provider.connection.getBalance(recipient.publicKey);

    const signature = await program.methods
      .solTransfer(amount)
      .accounts({
        sender: sender.publicKey,
        recipient: recipient.publicKey,
      })
      .rpc();

    const after = await provider.connection.getBalance(recipient.publicKey);

    console.log("Transaction signature:", signature);
    console.log(`Recipient went from ${before} to ${after} lamports`);

    if (after - before !== amount.toNumber()) {
      throw new Error("The recipient did not receive the expected amount of SOL");
    }
  });
});
