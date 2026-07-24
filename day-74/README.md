## Make one of your programs call the other

What changes when the program on the other end of a cross-program call is also a program you wrote? Mechanically, almost nothing, and that is the quietly powerful idea behind today’s challenge. The runtime does not care whether the callee is the System Program, the Token-2022 program, or a forty-line counter you scaffolded an hour ago. A program is a program, and any program can call any other.

For the last three days, every cross-program call you made pointed at code someone else wrote and deployed: you moved SOL through the System Program, and you minted units through the Token-2022 program. Today both ends of the call belong to you. You will deploy two of your own programs into one workspace and have one of them invoke the other.

This is the moment Solana’s composability stops being something that happens to you and becomes something you build with. In the language of the systems you already know, you are no longer just calling a third-party API. You are running two of your own services and wiring one to call the other’s endpoint. The counter program owns a piece of state and exposes an instruction to change it; the caller program reaches across and triggers that instruction on your behalf. Same building blocks, but now they are yours on both sides.

### Steps
1. Scaffold a fresh workspace, then add a second program to it. The first program (compose_lab) will be your caller; the one you add (counter) will be the callee. Drop the orphaned Rust integration tests both programs scaffold, since today’s lesson replaces the instructions they target:

>anchor init compose-lab
>cd compose-lab
>anchor new counter
>rm -rf programs/compose-lab/tests programs/counter/tests

Open programs/counter/src/lib.rs and write the callee. It holds a single number and exposes two instructions: one to create the account, one to add to it. Leave the declare_id! line exactly as anchor new generated it.

>use anchor_lang::prelude::*;
>
>declare_id!("..."); // keep the id anchor generated for you
>
>#[program]
>pub mod counter {
>    use super::*;
>
>    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
>        ctx.accounts.tally.count = 0;
>        Ok(())
>    }
>
>    pub fn increment(ctx: Context<Increment>) -> Result<()> {
>        ctx.accounts.tally.count += 1;
>        msg!("counter is now {}", ctx.accounts.tally.count);
>        Ok(())
>    }
>}
>
>#[derive(Accounts)]
>pub struct Initialize<'info> {
>    #[account(init, payer = payer, space = 8 + Tally::INIT_SPACE)]
>    pub tally: Account<'info, Tally>,
>    #[account(mut)]
>    pub payer: Signer<'info>,
>    pub system_program: Program<'info, System>,
>}
>
>#[derive(Accounts)]
>pub struct Increment<'info> {
>    #[account(mut)]
>    pub tally: Account<'info, Tally>,
>}
>
>#[account]
>#[derive(InitSpace)]
>pub struct Tally {
>    pub count: u64,
>}

Build the workspace once, then hand the counter’s interface to the caller. When you run anchor build, Anchor writes a JSON file to target/idl/counter.json. That file is the counter’s IDL: the machine-readable description of its instructions and accounts, essentially the API contract for your program. Copy it into an idls folder, which is where the next step’s macro looks for it.

>anchor build
>mkdir idls
>cp target/idl/counter.json idls/

If a later build ever complains about a declared program id mismatch, run anchor keys sync and then anchor build again to realign the ids.

Now open programs/compose-lab/src/lib.rs and write the caller. The declare_program! macro reads idls/counter.json and generates a cpi module for the counter. That module hands you cpi::increment as a Rust function taking a CpiContext, exactly like the transfer and mint_to helpers you called for the System Program and Token-2022. You build the CpiContext the same way you have all week, remembering that Anchor 1.0’s first arg is the program’s Pubkey (use .key()), not its AccountInfo.

>use anchor_lang::prelude::*;
>
>declare_program!(counter);
>
>use counter::{
>    accounts::Tally,
>    cpi::{self, accounts::Increment},
>    program::Counter,
>};
>
>declare_id!("..."); // keep the id anchor generated for you
>
>#[program]
>pub mod compose_lab {
>    use super::*;
>
>    pub fn bump(ctx: Context<Bump>) -> Result<()> {
>        let cpi_ctx = CpiContext::new(
>            ctx.accounts.counter_program.key(),
>            Increment {
>                tally: ctx.accounts.tally.to_account_info(),
>            },
>        );
>        cpi::increment(cpi_ctx)?;
>        Ok(())
>    }
>}
>
>#[derive(Accounts)]
>pub struct Bump<'info> {
>    #[account(mut)]
>    pub tally: Account<'info, Tally>,
>    pub counter_program: Program<'info, Counter>,
>}

Notice the two roles the generated code plays: Increment is the accounts struct the counter expects, and Program<'info, Counter> validates that the program you are calling really is your counter and not an impostor at a different address.

Anchor 1.0 does not auto-create a TypeScript test directory, so make one. Everything this test imports — the Anchor 1.0 JS client (@anchor-lang/core) and chai — already ships with the scaffold, so there’s nothing extra to install:

>mkdir tests

Create tests/compose-lab.ts with the content below. It creates a fresh tally account by calling the counter’s initialize directly, then calls bump on the caller, which reaches across to the counter through the CPI. The assertion checks the count even though the test never touched increment itself.

>import * as anchor from "@anchor-lang/core";
>import { Program, web3 } from "@anchor-lang/core";
>import { assert } from "chai";
>import { Counter } from "../target/types/counter";
>import { ComposeLab } from "../target/types/compose_lab";
>
>const { Keypair, SystemProgram } = web3;
>
>describe("compose-lab", () => {
>  const provider = anchor.AnchorProvider.env();
>  anchor.setProvider(provider);
>
>  const counter = anchor.workspace.Counter as Program<Counter>;
>  const caller = anchor.workspace.ComposeLab as Program<ComposeLab>;
>
>  it("the caller bumps the counter through a CPI", async () => {
>    const tally = Keypair.generate();
>
>    await counter.methods
>      .initialize()
>      .accounts({
>        tally: tally.publicKey,
>        payer: provider.wallet.publicKey,
>        systemProgram: SystemProgram.programId,
>      })
>      .signers([tally])
>      .rpc();
>
>    await caller.methods
>      .bump()
>      .accounts({
>        tally: tally.publicKey,
>        counterProgram: counter.programId,
>      })
>      .rpc();
>
>    const state = await counter.account.tally.fetch(tally.publicKey);
>    assert.equal(state.count.toNumber(), 1);
>    console.log("counter value set by the caller:", state.count.toNumber());
>  });
>});

### Run it
Point the default [scripts] test in Anchor.toml at the mocha runner so anchor test actually executes your TypeScript file:

>[scripts]
>test = "yarn run ts-mocha -p ./tsconfig.json -t 1000000 tests/**/*.ts"

>anchor test

Anchor builds both programs, deploys them together to a surfpool validator, and runs your test. Watch for the green check and the logged line showing the counter sitting at 1.

Look closely at the CpiContext you built in the caller. It has the same shape as every cross-program call you made this week: a target program as the first argument, an accounts struct as the second, and a helper function that does the invoking. The only genuinely new piece was where cpi::increment came from. For the System Program you imported it from anchor_lang, and for Token-2022 you imported it from anchor_spl. This time you generated it yourself, straight from your own program’s interface.

That generation step is worth sitting with. Your caller’s Cargo.toml never listed the counter as a dependency. It never compiled the counter’s source. It read the counter’s IDL, the JSON contract, and built typed Rust bindings from that alone. Anchor calls this dependency-free composability, and it maps cleanly onto something you already do: calling a service from its published API contract rather than vendoring its codebase into your own. The counter could be rewritten internally tomorrow, and as long as its instruction signatures hold, your caller would not need to change a line.

So the counter ended at 1, and your test got there without ever calling increment. Your caller asked for it, the runtime paused mid-instruction, ran the counter’s logic, and returned. You have now seen a CPI from every angle this arc covers: into a built-in program, into the token program, out of a PDA your program signs for, and now between two programs you wrote and deployed side by side. Your programs are no longer islands. They are building blocks that any other program, including the next one you write, can compose.