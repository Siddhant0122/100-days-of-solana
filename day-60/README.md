## Add failure tests so green checks actually mean something

A passing test suite is a story. The question is whether it tells the truth. Right now your suite has two stories: initialize creates a counter, and increment bumps it. Both stories end with a smiley face. Neither story tries to lie. Today you teach your tests to be skeptical: you write two new tests that expect the program to refuse, and you assert that refusal happens for the right reason.

This is a Reinforce day. You are not adding new instructions, new accounts, or new constraints. The has_one = authority constraint you wired up on Day 59 is already protecting increment. The Anchor runtime is already rejecting unauthorized callers. Your test suite simply has not asked it to prove that yet. By the end of today, your suite will prove it on every run.

You are a backend engineer at a Web2 company. The team just shipped a permissions check on an admin endpoint. The PR included one test: the admin can call the endpoint. The reviewer pushes back: “Show me the test where a non-admin gets a 403.” That is the test that proves the gate is real. Without it, the next refactor could silently drop the auth check and your suite would still be all green.

Your Solana program is in the same spot. The constraint is there, the happy path is tested, but you have not written the test that fails when someone other than the authority tries to increment. Today you write the equivalent of the “403 test”, twice.

### Steps
#### Step 1: Open programs/counter/tests/counter.rs. Keep the passing initialize_then_increment test from Day 59 in this file. Tomorrow’s experiments depend on it, and a suite that only checks failures cannot catch a broken happy path. Today you are adding two failure tests below it, plus three small helpers (setup_svm_with_program, build_initialize_tx, build_increment_tx) that extract the boilerplate already living inside the Day 59 test. Once the helpers exist, you can refactor the existing test to call them too, but that cleanup is optional; deleting the test is not.
Your file already has a use block from Day 59. The only new name the helpers need is Pubkey, so merge it into your existing imports rather than pasting a second block (the compiler rejects duplicate names). The merged block should look like this:

>use anchor_lang::{
>    prelude::Pubkey,
>    solana_program::system_program,
>    AccountDeserialize, InstructionData, ToAccountMetas,
>};
>use litesvm::LiteSVM;
>use solana_instruction::Instruction;
>use solana_keypair::Keypair;
>use solana_signer::Signer;
>use solana_transaction::Transaction;
>Then add the helpers below the imports. They are mechanical:
>
>fn setup_svm_with_program() -> (LiteSVM, Pubkey) {
>    let mut svm = LiteSVM::new();
>    let program_id = counter::ID;
>    let so_path = concat!(env!("CARGO_MANIFEST_DIR"), "/../../target/deploy/counter.so");
>    svm.add_program_from_file(program_id, so_path).unwrap();
>    (svm, program_id)
>}
>
>fn build_initialize_tx(
>    svm: &LiteSVM,
>    program_id: Pubkey,
>    authority: &Keypair,
>    counter_kp: &Keypair,
>) -> Transaction {
>    let ix = Instruction {
>        program_id,
>        accounts: counter::accounts::Initialize {
>            counter: counter_kp.pubkey(),
>            authority: authority.pubkey(),
>            system_program: system_program::ID,
>        }
>        .to_account_metas(None),
>        data: counter::instruction::Initialize {}.data(),
>    };
>    Transaction::new_signed_with_payer(
>        &[ix],
>        Some(&authority.pubkey()),
>        &[authority, counter_kp],
>        svm.latest_blockhash(),
>    )
>}
>
>fn build_increment_tx(
>    svm: &LiteSVM,
>    program_id: Pubkey,
>    authority: &Keypair,
>    counter: Pubkey,
>) -> Transaction {
>    let ix = Instruction {
>        program_id,
>        accounts: counter::accounts::Increment {
>            counter,
>            authority: authority.pubkey(),
>        }
>        .to_account_metas(None),
>        data: counter::instruction::Increment {}.data(),
>    };
>    Transaction::new_signed_with_payer(
>        &[ix],
>        Some(&authority.pubkey()),
>        &[authority],
>        svm.latest_blockhash(),
>    )
>}

#### Step 2: Add the first failure test below the happy-path test. This test initializes a counter with authority_a, then tries to increment it while signing with authority_b. You expect the transaction to fail because the has_one = authority constraint compares the signer to the stored authority and finds a mismatch.
>#[test]
>fn increment_fails_when_wrong_authority_signs() {
>    let (mut svm, program_id) = setup_svm_with_program();
>
>    let authority_a = Keypair::new();
>    let authority_b = Keypair::new();
>    svm.airdrop(&authority_a.pubkey(), 1_000_000_000).unwrap();
>    svm.airdrop(&authority_b.pubkey(), 1_000_000_000).unwrap();
>
>    let counter = Keypair::new();
>
>    // authority_a creates the counter. This must succeed.
>    let init_tx = build_initialize_tx(
>        &svm,
>        program_id,
>        &authority_a,
>        &counter,
>    );
>    svm.send_transaction(init_tx).expect("initialize should succeed");
>
>    // authority_b tries to increment it. This must fail.
>    let bad_tx = build_increment_tx(
>        &svm,
>        program_id,
>        &authority_b,
>        counter.pubkey(),
>    );
>
>    let result = svm.send_transaction(bad_tx);
>    assert!(
>        result.is_err(),
>        "increment should fail when signed by the wrong authority"
>    );
>}

Notice that the helpers do all the plumbing. The test itself is now about intent: who is the wrong wallet, what call should be rejected, and what assertion proves it.

#### Step 3: Add a second failure test below the first. This one tries to initialize the same counter account twice. The first call should succeed. The second call should fail because Anchor’s init constraint refuses to overwrite an account that already exists at that address.
One subtlety: without the svm.expire_blockhash() call below, the two transactions would be byte-for-byte identical (same instruction, same payer, same blockhash, so the same signature), and LiteSVM, like a real cluster, rejects a duplicate signature as already processed before your program ever runs. The test would still see an error, but it would be the wrong error, and the constraint would go untested. Expiring the blockhash makes the second transaction genuinely new, so the failure comes from the account check and not the duplicate check.

>>#[test]
>fn initialize_fails_when_counter_already_exists() {
>    let (mut svm, program_id) = setup_svm_with_program();
>
>    let authority = Keypair::new();
>    svm.airdrop(&authority.pubkey(), 1_000_000_000).unwrap();
>
>    let counter = Keypair::new();
>
>    let first_tx = build_initialize_tx(
>        &svm,
>        program_id,
>        &authority,
>        &counter,
>    );
>    svm.send_transaction(first_tx).expect("first initialize should succeed");
>
>    // Advance the blockhash so the second transaction is not a duplicate
>    // of the first.
>    svm.expire_blockhash();
>
>    // Same counter keypair, same payer. The account is already on chain.
>    let second_tx = build_initialize_tx(
>        &svm,
>        program_id,
>        &authority,
>        &counter,
>    );
>
>    let result = svm.send_transaction(second_tx);
>    assert!(
>        result.is_err(),
>        "initializing the same counter twice should fail"
>    );
>}

#### Step 4: Look at what your two failure tests do not assert. They check that the transaction returned an error, but they do not check which error. For a Reinforce day this is fine, and you will tighten the assertion tomorrow when you deliberately weaken the constraint. For now, take a peek at the error each test observed: temporarily add println!("{:?}", result); just above the assert! in each failure test, then run cargo test -p counter -- --nocapture. The printed FailedTransactionMetadata returned by LiteSVM’s send_transaction includes the program logs. The mismatch test should mention a ConstraintHasOne failure. The double-init test should mention that the account is already in use. These are the receipts that prove the constraint did the work.
#### Step 5: Optional reinforcement: copy your happy-path increment test and add one extra send_transaction call at the end that uses Keypair::new() as the signer instead of the real authority. Confirm visually that the same constraint is doing the same job from a different angle. If you do this, do not commit the duplicate test, the point is to feel the symmetry, not to bloat the suite.

Run it
>cargo test -p counter

You should see three passing tests: initialize_then_increment from Day 59, plus the two new ones, increment_fails_when_wrong_authority_signs and initialize_fails_when_counter_already_exists. If the runner reports fewer than three, you deleted the happy-path test while refactoring; restore it before moving on, because tomorrow’s experiments need all three. The new tests count as passing because they successfully observed the program rejecting bad input. If either one prints a red FAILED, the assertion at the bottom did not see the error it expected, which means either the test plumbing is wrong or the program let through something it should have blocked. Read the panic message first, then re-read the constraint on the account struct.