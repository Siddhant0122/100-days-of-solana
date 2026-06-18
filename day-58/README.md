## Add state to your program and write your first LiteSVM test

Yesterday your program did almost nothing. It logged a line, returned Ok(()), and went home. That is fine for proving your toolchain works, but a program that does not change any state is just an expensive way to write to the runtime log. Today the program starts doing something a backend service would actually do: it accepts a request, creates a record, and writes data into it.

The record is going to be a counter. One field for who owns it, one field for the count. You have seen this shape before in every CRUD tutorial ever written. The interesting part is not the counter itself, it is everything Anchor does around it for you: allocating the on-chain account, paying the rent from the user’s wallet, stamping a discriminator so the program can later prove this account belongs to it, and exposing a typed Rust struct you can read and write like any other.

Once the program writes state, you need a way to prove it works without spending hours waiting for devnet. That is what LiteSVM is for. It is an in-process Solana virtual machine that runs your compiled program against a fresh ledger, executes a real transaction, and lets you read accounts back, all in milliseconds. Think of it as the Solana equivalent of spinning up an in-memory Postgres for a backend test: no servers, no flakiness, just your code and a controlled environment.

### Steps
#### Step 1: Open programs/counter/src/lib.rs. Replace the scaffolded body with a program that owns a Counter account and an initialize instruction:
>use anchor_lang::prelude::*;
>
>declare_id!("REPLACE_WITH_YOUR_DECLARED_ID");
>
>#[program]
>pub mod counter {
>    use super::*;
>
>    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
>        let counter = &mut ctx.accounts.counter;
>        counter.authority = ctx.accounts.authority.key();
>        counter.count = 0;
>        Ok(())
>    }
>}
>
>#[derive(Accounts)]
>pub struct Initialize<'info> {
>    #[account(
>        init,
>        payer = authority,
>        space = 8 + Counter::INIT_SPACE,
>    )]
>    pub counter: Account<'info, Counter>,
>    #[account(mut)]
>    pub authority: Signer<'info>,
>    pub system_program: Program<'info, System>,
>}
>
>#[account]
>#[derive(InitSpace)]
>pub struct Counter {
>    pub authority: Pubkey,
>    pub count: u64,
>}

Leave the declare_id! value as the one Anchor put there when it scaffolded the project. Three things are worth pointing at:

- #[account] on Counter tells Anchor this struct represents an on-chain account; it adds an 8-byte discriminator so the program can later verify “yes, this is one of mine.”
- #[derive(InitSpace)] auto-computes the byte size of the fields. The 8 + in the space attribute accounts for the discriminator that sits in front.
- init on the counter field is the constraint that does the heavy lifting: it makes a CPI to the System Program, allocates the right number of bytes, funds the rent from authority, and assigns the account to your program. You write one line; Anchor writes the boilerplate.
>Note: Before building, delete the default test_initialize.rs file that Anchor generated when it scaffolded the project. It still references the old initialize test setup and can cause issues with the build. You will write your own Rust test in a later step.

#### Step 2: Build the program so the test has a compiled artifact to load:
>anchor build
That produces target/deploy/counter.so, the SBF binary that LiteSVM will execute.

#### Step 3: Add a Rust integration test. From the project root, create the file programs/counter/tests/counter.rs (create the tests directory if it does not exist):
>use anchor_lang::{
>    solana_program::system_program,
>    AccountDeserialize, InstructionData, ToAccountMetas,
>};
>use counter::{accounts as counter_accounts, instruction as counter_instruction, Counter};
>use litesvm::LiteSVM;
>use solana_instruction::Instruction;
>use solana_keypair::Keypair;
>use solana_signer::Signer;
>use solana_transaction::Transaction;
>
>#[test]
>fn initialize_sets_count_to_zero() {
>    let mut svm = LiteSVM::new();
>
>    let payer = Keypair::new();
>    svm.airdrop(&payer.pubkey(), 10 * 1_000_000_000).unwrap();
>
>    let program_id = counter::ID;
>    let so_path = concat!(env!("CARGO_MANIFEST_DIR"), "/../../target/deploy/counter.so");
>    svm.add_program_from_file(program_id, so_path).unwrap();
>
>    let counter_kp = Keypair::new();
>
>    let ix = Instruction {
>        program_id,
>        accounts: counter_accounts::Initialize {
>            counter: counter_kp.pubkey(),
>            authority: payer.pubkey(),
>            system_program: system_program::ID,
>        }
>        .to_account_metas(None),
>        data: counter_instruction::Initialize {}.data(),
>    };
>
>    let tx = Transaction::new_signed_with_payer(
>        &[ix],
>        Some(&payer.pubkey()),
>        &[&payer, &counter_kp],
>        svm.latest_blockhash(),
>    );
>
>    svm.send_transaction(tx).expect("initialize should succeed");

>    let raw = svm.get_account(&counter_kp.pubkey()).expect("counter exists");
>    let state = Counter::try_deserialize(&mut raw.data.as_slice()).unwrap();

>    assert_eq!(state.count, 0);
>    assert_eq!(state.authority, payer.pubkey());
>}

A few things to notice. The accounts and instruction modules under counter:: are generated for free by the #[program] macro: one struct per #[derive(Accounts)] with the same fields, one struct per instruction handler that knows how to serialize itself with the right discriminator. That is why you can construct a real transaction without hand-rolling any byte layout.

The counter_kp keypair signs the transaction alongside payer because the System Program will not create an account at a given address unless the holder of that address proves they want it. This is the same rule you ran into on Day 17 when you saw why a transfer needs a signature.

#### Step 4: Add the test dependency. Open programs/counter/Cargo.toml and look at the [dev-dependencies] section. Anchor already scaffolds most of what the test needs, including LiteSVM:
>[dev-dependencies]
>litesvm = "0.10.0"
>solana-message = "3.0.1"
>solana-transaction = "3.0.2"
>solana-signer = "3.0.0"
>solana-keypair = "3.0.1"

The only crate the test imports that is not already there is solana-instruction (for the Instruction type). Add this one line under [dev-dependencies]:

>solana-instruction = "3"

If cargo warns about resolver mismatches, set resolver = "2" under [package].

Run it
#### Step 5: Run the test from the project root:
>cargo test -p counter --test counter -- --nocapture

You should see one passing test in well under a second. If you want to see the program logs that the runtime emitted, change the .expect(...) on send_transaction to capture the result and print result.logs.