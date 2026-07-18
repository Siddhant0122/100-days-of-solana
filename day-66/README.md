## Add a config PDA and constraints that hold two accounts together

A program with one PDA is a tutorial. A program that holds two related PDAs and refuses to operate on them unless they line up the way the program expects is where Solana starts to feel like a database with rules attached to every row.

Yesterday you turned a per-user counter into a real program. Every wallet that called init_counter got its own PDA, and the program signed for the address so the client never had to track a keypair. That part is solid. The problem with where you left off is that the program enforces almost nothing beyond ownership of the counter itself. Anyone can initialize. There is no global on switch. There is no way for you, as the program author, to pause new increments if something goes wrong. And the counter does not check that the wallet calling increment is actually the wallet that the counter says it belongs to.

The web2 reference point here is a small SaaS app with two tables: a settings row that lives once at the top of the database and holds feature flags, and a counters row per user with a foreign key back to the user. Postgres lets you express that with a primary key, a unique index, and a foreign key constraint. Anchor lets you express the same thing with seeds, bump, and has_one, except the database is the Solana ledger and the constraint check runs on chain every time someone calls your program.

Today you add a second PDA type, wire constraints between the two, and prove with a test that bad calls bounce before your handler code ever runs.

### Steps
1. Open programs/counter/src/lib.rs and add a second account type. The Config account is a singleton, meaning there is only ever one of it for the whole program. You guarantee that by deriving its address from a single fixed seed: the byte string "config". Use the InitSpace derive so Anchor calculates the on-chain byte layout for you. Drop this struct alongside the existing Counter struct — the use anchor_lang::prelude::*; line from yesterday already covers the imports.

>#[account]
>#[derive(InitSpace)]
>pub struct Config {
>    pub admin: Pubkey,
>    pub paused: bool,
>    pub total_counters: u64,
>    pub bump: u8,
>}

2. Extend the error enum for the new failure modes. You already have CounterError from yesterday with the Overflow variant. Open it and add the Paused variant alongside it so the client gets a readable message back instead of a raw error code.

>#[error_code]
>pub enum CounterError {
>    #[msg("counter overflow")]
>    Overflow,
>    #[msg("Increments are currently paused")]
>    Paused,
>}

3. Add an init_config instruction and its Accounts struct. The first wallet that calls this becomes the admin. After that, the singleton exists and cannot be re-initialized because init will fail on an account that already holds data.

>pub fn init_config(ctx: Context<InitConfig>) -> Result<()> {
>    let config = &mut ctx.accounts.config;
>    config.admin = ctx.accounts.admin.key();
>    config.paused = false;
>    config.total_counters = 0;
>    config.bump = ctx.bumps.config;
>    Ok(())
>}
>
>#[derive(Accounts)]
>pub struct InitConfig<'info> {
>    #[account(
>        init,
>        payer = admin,
>        space = 8 + Config::INIT_SPACE,
>        seeds = [b"config"],
>        bump
>    )]
>    pub config: Account<'info, Config>,
>    #[account(mut)]
>    pub admin: Signer<'info>,
>    pub system_program: Program<'info, System>,
>}>

4. Add a set_paused instruction so the admin can flip the switch. The interesting constraint here is has_one = admin. Anchor reads the admin field off the deserialized Config account and checks that it equals the public key of the account in the struct named admin. If a different wallet tries to call this, the transaction fails before your handler runs.

>pub fn set_paused(ctx: Context<SetPaused>, paused: bool) -> Result<()> {
>    ctx.accounts.config.paused = paused;
>    Ok(())
>}
>
>#[derive(Accounts)]
>pub struct SetPaused<'info> {
>    #[account(
>        mut,
>        seeds = [b"config"],
>        bump = config.bump,
>        has_one = admin,
>    )]
>    pub config: Account<'info, Config>,
>    pub admin: Signer<'info>,
>}

5. Wire the Counter account into the new world. Two changes. First, the existing Counter already stores user: Pubkey from yesterday. Make sure it does, because you are about to enforce it. Second, change InitCounter so it loads the config, bumps the user count, and requires the config to exist.

>pub fn init_counter(ctx: Context<InitCounter>) -> Result<()> {
>    let counter = &mut ctx.accounts.counter;
>    counter.user = ctx.accounts.user.key();
>    counter.count = 0;
>    counter.bump = ctx.bumps.counter;
>
>    let config = &mut ctx.accounts.config;
>    config.total_counters = config.total_counters.checked_add(1).unwrap();
>    Ok(())
>}
>
>#[derive(Accounts)]
>pub struct InitCounter<'info> {
>    #[account(
>        mut,
>        seeds = [b"config"],
>        bump = config.bump,
>    )]
>    pub config: Account<'info, Config>,
>    #[account(
>        init,
>        payer = user,
>        space = 8 + Counter::INIT_SPACE,
>        seeds = [b"counter", user.key().as_ref()],
>        bump
>    )]
>    pub counter: Account<'info, Counter>,
>    #[account(mut)]
>    pub user: Signer<'info>,
>    pub system_program: Program<'info, System>,
>}

6. Lock down increment with two new constraints. The constraint = !config.paused guard reads the config account and rejects the call if the pause flag is set. The has_one = user guard reads counter.user and rejects the call unless the signer matches. Together they enforce a global rule and a per-row rule in the same instruction.

>pub fn increment(ctx: Context<Increment>) -> Result<()> {
>    let counter = &mut ctx.accounts.counter;
>    counter.count = counter.count.checked_add(1).unwrap();
>    Ok(())
>}
>
>#[derive(Accounts)]
>pub struct Increment<'info> {
>    #[account(
>        seeds = [b"config"],
>        bump = config.bump,
>        constraint = !config.paused @ CounterError::Paused,
>    )]
>    pub config: Account<'info, Config>,
>    #[account(
>        mut,
>        seeds = [b"counter", user.key().as_ref()],
>        bump = counter.bump,
>        has_one = user,
>    )]
>    pub counter: Account<'info, Counter>,
>    pub user: Signer<'info>,
>}

7. Replace the entire contents of tests/counter.ts with the version below. This is a full rewrite of yesterday’s test, not an addition: it swaps in a new describe block that covers the new paths — a happy path that initializes the config and counter, and a sad path that proves the pause works. The pattern matters more than the exact assertions.

>import * as anchor from "@anchor-lang/core";
>import { Program } from "@anchor-lang/core";
>import { Counter } from "../target/types/counter";
>import { PublicKey } from "@solana/web3.js";
>import { assert } from "chai";
>
>describe("counter with config", () => {
>  const provider = anchor.AnchorProvider.env();
>  anchor.setProvider(provider);
>  const program = anchor.workspace.Counter as Program<Counter>;
>  const admin = provider.wallet;
>
>  const [configPda] = PublicKey.findProgramAddressSync(
>    [Buffer.from("config")],
>    program.programId
>  );
>  const [counterPda] = PublicKey.findProgramAddressSync(
>    [Buffer.from("counter"), admin.publicKey.toBuffer()],
>    program.programId
>  );
>
>  it("initializes config and a counter, then increments", async () => {
>    await program.methods.initConfig().rpc();
>    await program.methods.initCounter().rpc();
>    await program.methods.increment().rpc();
>
>    const counter = await program.account.counter.fetch(counterPda);
>    assert.equal(counter.count.toNumber(), 1);
>  });
>
>  it("refuses to increment when paused", async () => {
>    await program.methods.setPaused(true).rpc();
>    try {
>      await program.methods.increment().rpc();
>      assert.fail("expected pause error");
>    } catch (err: any) {
>      assert.include(err.toString(), "Paused");
>    }
>    await program.methods.setPaused(false).rpc();
>  });
>});

### Run it
>anchor build
>anchor test --validator legacy

The --validator legacy flag points Anchor at the solana-test-validator from your Solana toolchain. Anchor defaults to a separate validator called surfpool, and a bare anchor test without it installed fails with Failed to spawn surfpool: No such file or directory. Your Anchor.toml test script from Day 65 (the ts-mocha line) still applies — without it, anchor test runs the Rust suite instead of tests/counter.ts.

You should see both tests pass. If the second test passes but the assertion message looks wrong, peek at the full error output: Anchor prints the constraint that failed and the error code from your enum, which is exactly what you want a client to see.