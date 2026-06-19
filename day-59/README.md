## Add an increment instruction and test both calls end to end

Today, you are introducing your first account constraint, a one-line guarantee that the wallet calling increment is the same wallet that created the counter application you built yesterday. Anchor enforces it for you at the macro layer, so by the time your handler runs the check has already passed. Tomorrow you will deliberately break that constraint to see the failure path. Today you prove the happy path works for both instructions back to back.

### Steps
#### Step 1: Open programs/counter/src/lib.rs. Add a second handler called increment below your existing initialize handler. It takes no arguments, reads the counter account as mutable, and bumps the count by one using checked_add so an overflow returns an error instead of panicking.
>pub fn increment(ctx: Context<Increment>) -> Result<()> {
>    let counter = &mut ctx.accounts.counter;
>    counter.count = counter.count
>        .checked_add(1)
>        .ok_or(ProgramError::ArithmeticOverflow)?;
>    Ok(())
>}

#### Step 2: Below your Initialize accounts struct, add an Increment accounts struct. This is where the constraint lives. The has_one = authority attribute tells Anchor: before this handler runs, confirm the authority field stored inside the counter account matches the authority signer passed in this transaction. If they do not match, the transaction fails before your code executes.
>#[derive(Accounts)]
>pub struct Increment<'info> {
>    #[account(mut, has_one = authority)]
>    pub counter: Account<'info, Counter>,
>    pub authority: Signer<'info>,
>}

#### Step 3: Rebuild the program so the new instruction discriminator and the updated IDL land in target/deploy/ and target/idl/. The build step also regenerates the typed account and instruction helpers your tests rely on.
>anchor build

#### Step 4: Open the test file you created on Day 58 at programs/counter/tests/counter.rs. Replace its entire contents with the version below: the same imports, plus a single test that covers both instructions end to end. It calls initialize, then increment, then reads the account back and asserts count == 1.
>use anchor_lang::{
>    solana_program::system_program,
>    AccountDeserialize, InstructionData, ToAccountMetas,
>};
>use litesvm::LiteSVM;
>use solana_instruction::Instruction;
>use solana_keypair::Keypair;
>use solana_signer::Signer;
>use solana_transaction::Transaction;
>
>#[test]
>fn initialize_then_increment() {
>    let mut svm = LiteSVM::new();
>    let program_id = counter::ID;
>    let so_path = concat!(env!("CARGO_MANIFEST_DIR"), "/../../target/deploy/counter.so");
>    svm.add_program_from_file(program_id, so_path).unwrap();
>
>    let authority = Keypair::new();
>    svm.airdrop(&authority.pubkey(), 1_000_000_000).unwrap();
>    let counter_kp = Keypair::new();
>
>    // 1) initialize
>    let init_ix = Instruction {
>        program_id,
>        accounts: counter::accounts::Initialize {
>            counter: counter_kp.pubkey(),
>            authority: authority.pubkey(),
>            system_program: system_program::ID,
>        }
>        .to_account_metas(None),
>        data: counter::instruction::Initialize {}.data(),
>    };
>    let bh = svm.latest_blockhash();
>    let tx = Transaction::new_signed_with_payer(
>        &[init_ix],
>        Some(&authority.pubkey()),
>        &[&authority, &counter_kp],
>        bh,
>    );
>    svm.send_transaction(tx).unwrap();
>
>    // 2) increment
>    let inc_ix = Instruction {
>        program_id,
>        accounts: counter::accounts::Increment {
>            counter: counter_kp.pubkey(),
>            authority: authority.pubkey(),
>        }
>        .to_account_metas(None),
>        data: counter::instruction::Increment {}.data(),
>    };
>    let bh = svm.latest_blockhash();
>    let tx = Transaction::new_signed_with_payer(
>        &[inc_ix],
>        Some(&authority.pubkey()),
>        &[&authority],
>        bh,
>    );
>    svm.send_transaction(tx).unwrap();
>
>    // 3) read and assert
>    let account = svm.get_account(&counter_kp.pubkey()).unwrap();
>    let parsed = counter::Counter::try_deserialize(&mut account.data.as_slice()).unwrap();
>    assert_eq!(parsed.count, 1);
>    assert_eq!(parsed.authority, authority.pubkey());
>}


Run it
>anchor build && cargo test -p counter -- --nocapture