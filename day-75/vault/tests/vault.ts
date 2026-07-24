import * as anchor from "@anchor-lang/core";
import { Program, web3 } from "@anchor-lang/core";
import { Vault } from "../target/types/vault";
import { assert } from "chai";

const { PublicKey, SystemProgram, LAMPORTS_PER_SOL } = web3;

describe("vault", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Vault as Program<Vault>;
  const user = provider.wallet.publicKey;

  const [vault] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), user.toBuffer()],
    program.programId
  );

  it("deposits, then the program signs to withdraw", async () => {
    const amount = new anchor.BN(0.5 * LAMPORTS_PER_SOL);

    await program.methods
      .deposit(amount)
      .accountsPartial({ user, vault, systemProgram: SystemProgram.programId })
      .rpc();

    console.log("vault after deposit:", await provider.connection.getBalance(vault));

    await program.methods
      .withdraw(amount)
      .accountsPartial({ user, vault, systemProgram: SystemProgram.programId })
      .rpc();

    const finalBalance = await provider.connection.getBalance(vault);
    console.log("vault after withdraw:", finalBalance);
    assert.equal(finalBalance, 0);
  });
});