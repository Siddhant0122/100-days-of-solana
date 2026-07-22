## Move SOL from inside your program with a CPI

A Solana program can pause in the middle of its own instruction, call a completely different program, and then pick up where it left off once that program returns. That call is a cross-program invocation, or CPI, and it is the single feature that lets thousands of independent programs compose into one ecosystem instead of thousands of walled gardens.

You have spent the last two content themes writing programs that own and mutate their own accounts. Your counter incremented its own PDA. Your close instruction reclaimed its own rent. Everything happened inside your program’s four walls.

Now you want your program to move SOL. Here is the catch: your program cannot just subtract lamports from one wallet and add them to another. On Solana, only the program that owns an account is allowed to reduce its lamport balance, and ordinary wallets are owned by the System Program, not by you. So to move SOL out of a wallet, you have to ask the System Program to do it for you. That request is a CPI. If you have ever built a service that calls another team’s well-tested billing API instead of reimplementing payments yourself, this is the same instinct: call the program that already owns the logic rather than rebuilding it.

Today you will write the smallest possible CPI: an instruction in your own Anchor program that calls the System Program’s transfer instruction to send SOL from a signer to a recipient.

#### A CPI in Anchor comes down to three small pieces, and it helps to know each one before you type it:
- The accounts struct (Transfer): the System Program’s transfer needs to know two accounts, who the SOL comes from and who it goes to. Anchor ships a ready-made struct for this.
- The CpiContext: a small bundle that says “here is the program I am calling, and here are the accounts it needs.” You hand it the target program’s account info plus that accounts struct.
- The helper function (transfer): Anchor’s wrapper that takes your CpiContext and the amount, builds the real instruction, and fires the invocation into the runtime.
- Because the account paying the SOL is a real signer on your outer transaction, the runtime forwards that signature into the CPI for you. You will not need any extra signing logic today. Signing on behalf of a PDA is its own skill, and it is coming later this week.

### Steps

1. Create a fresh Anchor project and move into it. This scaffolds the program, a default Anchor.toml, and the local config.
>anchor init sol-mover
>cd sol-mover

Anchor 1.0 scaffolds programs/sol-mover/src/lib.rs along with helper modules (constants.rs, error.rs, instructions/, state.rs) and a 

Rust integration test at programs/sol-mover/tests/test_initialize.rs. You will not use any of them today, so delete the Rust test directory so the build does not try to compile it against the instructions you are about to replace:

>rm -rf programs/sol-mover/tests

Now open programs/sol-mover/src/lib.rs. Anchor generated a starter program with a declare_id!("...") line and a sample initialize instruction. Replace the file with the code below, with one important exception: keep the declare_id! line that Anchor wrote for you. That string is the unique on-chain address of your program. The one shown here is only a placeholder, and if the two ever drift apart you will see a “declared program id does not match” error, which anchor keys sync fixes.

>use anchor_lang::prelude::*;
>use anchor_lang::system_program::{transfer, Transfer};
>
>declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS"); // keep YOUR generated id, not this one
>
>#[program]
>pub mod sol_mover {
>    use super::*;
>
>    pub fn sol_transfer(ctx: Context<SolTransfer>, amount: u64) -> Result<()> {
>        // Name the two accounts the System Program's transfer needs.
>        let cpi_accounts = Transfer {
>            from: ctx.accounts.sender.to_account_info(),
>            to: ctx.accounts.recipient.to_account_info(),
>        };
>
>        // Bundle the target program with those accounts.
>        let cpi_context = CpiContext::new(
>            ctx.accounts.system_program.key(),
>            cpi_accounts,
>        );
>
>        // Fire the cross-program invocation.
>        transfer(cpi_context, amount)?;
>
>        Ok(())
>    }
>}
>
>#[derive(Accounts)]
>pub struct SolTransfer<'info> {
>    #[account(mut)]
>    pub sender: Signer<'info>,
>    #[account(mut)]
>    pub recipient: SystemAccount<'info>,
>    pub system_program: Program<'info, System>,
>}

A quick note on the accounts struct: sender and recipient are both marked mut because both balances change. sender is a Signer because moving someone’s SOL requires their authorization. And you must include system_program in the struct, because to call a program over a CPI, that program has to be one of the accounts passed into your instruction.

One detail about that CpiContext::new call: in Anchor 1.0 the first argument is the program id (a Pubkey), not the program’s AccountInfo. That is why the code uses system_program.key(). If you have written CPIs against an older Anchor and reflexively type .to_account_info(), the compiler will tell you with expected Pubkey, found AccountInfo<'_>.

Anchor 1.0 does not auto-create a TypeScript test for you, so make the directory and the file yourself:
>mkdir tests

Open tests/sol-mover.ts and paste this test. It sends a quarter of a SOL through your new instruction and checks that the recipient actually received it.

>import * as anchor from "@anchor-lang/core";
>import { Program, web3 } from "@anchor-lang/core";
>import { SolMover } from "../target/types/sol_mover";
>
>const { Keypair, LAMPORTS_PER_SOL } = web3;
>
>describe("sol-mover", () => {
>  const provider = anchor.AnchorProvider.env();
>  anchor.setProvider(provider);
>
>  const program = anchor.workspace.SolMover as Program<SolMover>;
>  const sender = provider.wallet;
>
>  it("moves SOL with a CPI to the System Program", async () => {
>    const recipient = Keypair.generate();
>    const amount = new anchor.BN(0.25 * LAMPORTS_PER_SOL);
>
>    const before = await provider.connection.getBalance(recipient.publicKey);
>
>    const signature = await program.methods
>      .solTransfer(amount)
>      .accounts({
>        sender: sender.publicKey,
>        recipient: recipient.publicKey,
>      })
>      .rpc();
>
>    const after = await provider.connection.getBalance(recipient.publicKey);
>
>    console.log("Transaction signature:", signature);
>    console.log(`Recipient went from ${before} to ${after} lamports`);
>
>    if (after - before !== amount.toNumber()) {
>      throw new Error("The recipient did not receive the expected amount of SOL");
>    }
>  });
>});

Notice that the test passes only sender and recipient to .accounts(). You never list systemProgram, because Anchor recognizes that account by name and fills it in for you. The instruction name sol_transfer in Rust becomes solTransfer in TypeScript, and anchor.workspace.SolMover is just the PascalCase version of your program’s name.

The default Anchor.toml Anchor 1.0 generates has test = "cargo test", which would skip your TypeScript file entirely. Change the [scripts] block so anchor test runs the mocha file you just wrote:

>[scripts]
>test = "yarn run ts-mocha -p ./tsconfig.json -t 1000000 tests/**/*.ts"

### Run it

from the sol-mover project root
>anchor keys sync   # make declare_id! match your program keypair
>anchor build       # compile the program and generate the IDL and TS types
>anchor test        # start surfpool, deploy, and run the test

If you see a passing test and a log line where the recipient’s balance jumped from 0 to 250000000 lamports, your program just moved real SOL through another program. That is your first CPI.

You wrote an instruction that does not move any money on its own. Instead it delegates. The Transfer struct named the two accounts involved, the CpiContext pointed at the System Program and carried those accounts along, and transfer(cpi_context, amount) handed the whole package to the runtime, which then ran the System Program’s transfer logic as if it had been called directly. Your program was the caller; the System Program was the callee.

This is the microservice-to-microservice call you already know, expressed on-chain. You would never reimplement Stripe’s charge endpoint inside your own service just to take a payment, and for the same reason you do not reimplement lamport accounting inside your program. You call the program that owns that responsibility. The difference on Solana is that the “API call” happens atomically inside one transaction: if the transfer fails, your entire instruction rolls back, so you never end up half-done.

One detail worth holding onto: you did not write a single line of signing code, yet the transfer was authorized. That worked because sender signed the outer transaction, and the runtime carries that signer’s authority down into the CPI automatically. That clean handoff only happens when a real keypair signs. When the account paying the SOL is a PDA, which has no private key, you have to teach the CPI how to “sign” with seeds instead. That is exactly where this arc heads next.