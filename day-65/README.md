## Build a per-user counter with PDA state

A counter program that can only count for one user is a demo. Today you build the version that can count for everyone, with a separate state account for each wallet, and you do not have to track a single keypair to make it work.

Yesterday you derived a PDA in a script. You printed the address, watched the bump pop out, and stared at it until the mechanics felt familiar. Today the PDA stops living in a one-off script and moves into a program that owns it.

The shape of the problem is this: in the counter from the last arc, the client had to generate a keypair, sign for it, and pass it in. That works for a tutorial. It falls apart the moment you want one counter per user, because every user would have to remember a random keypair you generated for them. Real applications do not store their state that way. They derive deterministic addresses from inputs the program already knows, and they let the program sign for those addresses on demand.

The web2 mental model that lands here is the deterministic database key. Imagine a Postgres table where the primary key is (user_id, "counter"). You never have to look the row up by some random UUID, because the key falls out of who is asking. PDAs do the same thing for accounts on Solana, and Anchor gives you the constraints to enforce that mapping at the program level.

### Steps
1. Create a fresh Anchor workspace so you can see this program in isolation. Run **anchor init counter** and step into the new directory. Open programs/counter/src/lib.rs. Also delete the generated programs/counter/tests/test_initialize.rs: it tests an Initialize instruction this program does not have, so it will fail to compile and error out when you run the tests.

2. Replace the contents of lib.rs with the program below. The declare_id!("…") line in the snippet is a placeholder; keep the pubkey that anchor init generated for you on the line that already exists in your file, since it is paired with the program keypair under target/deploy/counter-keypair.json. If you accidentally clobber it, do not panic — step 6 shows how anchor keys sync puts both halves back in sync. Read the rest of the file before you save. Every line is doing work.

>use anchor_lang::prelude::*;
>
>declare_id!("YOUR_PROGRAM_ID_HERE");
>
>#[program]
>pub mod counter {
>    use super::*;
>
>    pub fn init_counter(ctx: Context<InitCounter>) -> Result<()> {
>        let counter = &mut ctx.accounts.counter;
>        counter.user = ctx.accounts.user.key();
>        counter.count = 0;
>        counter.bump = ctx.bumps.counter;
>        Ok(())
>    }
>
>    pub fn increment(ctx: Context<Increment>) -> Result<()> {
>        let counter = &mut ctx.accounts.counter;
>        counter.count = counter
>            .count
>            .checked_add(1)
>            .ok_or(CounterError::Overflow)?;
>        Ok(())
>    }
>}
>
>#[derive(Accounts)]
>pub struct InitCounter<'info> {
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
>
>#[derive(Accounts)]
>pub struct Increment<'info> {
>    #[account(
>        mut,
>        seeds = [b"counter", user.key().as_ref()],
>        bump = counter.bump,
>    )]
>    pub counter: Account<'info, Counter>,
>    pub user: Signer<'info>,
>}
>
>#[account]
>#[derive(InitSpace)]
>pub struct Counter {
>    pub user: Pubkey,
>    pub count: u64,
>    pub bump: u8,
>}
>
>#[error_code]
>pub enum CounterError {
>    #[msg("counter overflow")]
>    Overflow,
>}

3. Look at the InitCounter struct. The seeds constraint says this counter’s address is derived from the byte string "counter" and the signer’s public key. The bump constraint asks Anchor to compute the canonical bump for you. The init constraint says “create this account if it does not exist,” and the payer and space tell Anchor who is paying for rent and how many bytes to reserve.

4. Now look at Increment. There is no has_one, no manual owner check, no signature gymnastics. The seeds constraint is the authorization. If someone other than the counter’s owner calls increment, the seed derivation will produce a different address than the counter account they passed in, and Anchor will refuse the transaction before your handler runs. The keypair you do not own becomes the access control you do not have to write.

5. Notice 8 + Counter::INIT_SPACE. The InitSpace derive macro computes the byte size of your account data automatically, and the extra 8 bytes are for Anchor’s discriminator, which is the prefix Anchor stamps on every account so it knows what type it is later. Forgetting that 8 is one of the most common ways to corrupt an account, so notice it.

6. Save the file, then run **anchor build** from the workspace root. The program ID in declare_id! and the one under [programs.localnet] in Anchor.toml should already match the keypair Anchor generated for you. If for any reason they have drifted apart (for example, you ran anchor build before pasting the program in), run anchor keys sync and Anchor will rewrite both sides for you. Then run anchor build one more time.

7. Create tests/counter.ts at the workspace root. Add a test that exercises both handlers and proves the per-user mapping works.

>import * as anchor from "@anchor-lang/core";
>import { Program } from "@anchor-lang/core";
>import { Counter } from "../target/types/counter";
>import { PublicKey, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
>import { assert } from "chai";
>
>describe("counter", () => {
>  const provider = anchor.AnchorProvider.env();
>  anchor.setProvider(provider);
>  const program = anchor.workspace.Counter as Program<Counter>;
>
>  const counterPda = (user: PublicKey) =>
>    PublicKey.findProgramAddressSync(
>      [Buffer.from("counter"), user.toBuffer()],
>      program.programId
>    )[0];
>
>  it("creates a counter per user and increments independently", async () => {
>    const alice = provider.wallet.publicKey;
>    const bob = Keypair.generate();
>
>    // fund bob so he can pay rent
>    const sig = await provider.connection.requestAirdrop(
>      bob.publicKey,
>      2 * LAMPORTS_PER_SOL
>    );
>    const latest = await provider.connection.getLatestBlockhash();
>    await provider.connection.confirmTransaction({ signature: sig, ...latest }, "confirmed");
>
>    await program.methods
>      .initCounter()
>      .accounts({ user: alice })
>      .rpc();
>
>    await program.methods
>      .initCounter()
>      .accounts({ user: bob.publicKey })
>      .signers([bob])
>      .rpc();
>
>    await program.methods.increment().accounts({ user: alice }).rpc();
>    await program.methods.increment().accounts({ user: alice }).rpc();
>    await program.methods.increment().accounts({ user: bob.publicKey }).signers([bob]).rpc();
>
>    const aliceState = await program.account.counter.fetch(counterPda(alice));
>    const bobState = await program.account.counter.fetch(counterPda(bob.publicKey));
>
>    assert.equal(aliceState.count.toNumber(), 2);
>    assert.equal(bobState.count.toNumber(), 1);
>    assert.ok(aliceState.user.equals(alice));
>    assert.ok(bobState.user.equals(bob.publicKey));
>  });
>});

8. Read the test before you run it. Two different signers, two different PDAs, derived from the same seed prefix and the signer’s pubkey. Alice’s counter does not know Bob exists. That is the whole point.

9. Point anchor test at the TypeScript test you just wrote. Open Anchor.toml and look at the [scripts] section. The scaffold sets test = "cargo test", which runs the Rust suite and ignores tests/counter.ts entirely. Replace that line so it runs ts-mocha instead:
>[scripts]
>test = "yarn run ts-mocha -p ./tsconfig.json -t 1000000 tests/**/*.ts"

anchor test may print a MODULE_TYPELESS_PACKAGE_JSON warning. It is harmless and the tests still pass. Adding "type": "module" to package.json silences it — that is your choice — but if you do, remember to remove it on Day 68, where it breaks the ts-node script.

### Run it

>anchor test --validator legacy

The --validator legacy flag tells Anchor to use the solana-test-validator from your Solana toolchain. Anchor defaults to a separate validator called surfpool, and a bare anchor test without it installed fails with Failed to spawn surfpool: No such file or directory. The legacy validator is already on your machine.

Both initCounter calls should succeed, three increment calls should succeed, and the final assertions should pass. If you see an Anchor error about the seed constraint, the most common cause is a typo in the seed bytes between the program and the client. The string in b"counter" on the Rust side and Buffer.from("counter") on the TypeScript side has to match exactly.

