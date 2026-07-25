## Write tests that try to rob you

Your test suite so far has been an optimist. Every test you have written asks the same question: does the happy path work? Today you hire a pessimist. You will write tests whose entire job is to make your program fail, and then assert that it fails for exactly the right reason. A green checkmark on a test named attacker_cannot_withdraw means something an attacker tried did not work, and you have proof.

This is the natural next move after the last two days. You audited your program for missing owner and signer checks, then you welded the gaps shut with Anchor constraints. A constraint you cannot see fail is a constraint you are only hoping is there. Adversarial tests turn that hope into evidence.

A penetration tester does not read your code and nod approvingly. They send the request you never expected: the withdrawal signed by the wrong key, the account that looks right but is owned by someone else, the amount that quietly overflows a counter. On a public chain there is no rate limiter and no friendly QA team filing a bug report. The first person to find the hole is usually the one who drains it, and the transaction is final.

So you go first. Each adversarial test encodes one specific way someone could try to abuse your program, runs it against a real in-process Solana VM with LiteSVM, and asserts that the runtime rejects it with the precise error you intended. When the test passes, you have demonstrated that the defense holds. When it fails, you have found a real vulnerability in a place where the only thing at risk is a unit test, not your users’ funds.

Note the discipline that keeps today honest: a test that expects a failure must assert which failure. A transaction can fail for boring reasons (a missing signature, a typo in an account list) that have nothing to do with your security logic. If you only assert “this failed,” a broken defense can hide behind an unrelated error and your test still goes green. You will check the exact error code every time.

You will build a small vault program in its own fresh project and write a dedicated adversarial test module against it. The vault is deliberately minimal: a Vault account that stores an authority and a balance, with a withdraw instruction guarded by the same kind of constraints you practiced yesterday. Working in a standalone project keeps the attack surface small and the crate name predictable, so the test harness lines up without renaming. Once the muscle is built, you map these patterns onto whatever instruction in your own programs holds the most power.

### Steps
1. Scaffold the vault program. Create a fresh project and drop in the code you are about to attack. The withdraw handler is the high-value target: it moves balance out, so it is the instruction worth attacking from every angle.

>anchor init vault
>cd vault

Anchor scaffolds a default program with a no-op initialize instruction and a matching test. Delete that default test, programs/vault/tests/test_initialize.rs, since it references initialize and will not compile against the vault code. Then replace the contents of programs/vault/src/lib.rs with the program below.

>use anchor_lang::prelude::*;
>
>declare_id!("REPLACE_WITH_YOUR_DECLARED_ID");
>
>#[program]
>pub mod vault {
>    use super::*;
>
>    pub fn withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
>        let vault = &mut ctx.accounts.vault;
>
>        // Arithmetic safety: refuse to underflow instead of wrapping.
>        vault.balance = vault
>            .balance
>            .checked_sub(amount)
>            .ok_or(VaultError::InsufficientFunds)?;
>
>        Ok(())
>    }
>}
>
>#[derive(Accounts)]
>pub struct Withdraw<'info> {
>    #[account(
>        mut,
>        seeds = [b"vault", authority.key().as_ref()],
>        bump,
>        has_one = authority,
>    )]
>    pub vault: Account<'info, Vault>,
>    pub authority: Signer<'info>,
>}
>
>#[account]
>pub struct Vault {
>    pub authority: Pubkey,
>    pub balance: u64,
>}
>
>#[error_code]
>pub enum VaultError {
>    #[msg("Withdrawal exceeds vault balance")]
>    InsufficientFunds, // Anchor assigns this custom code 6000
>}

Leave the declare_id! value as the one Anchor generated for your project. The REPLACE_WITH_YOUR_DECLARED_ID above is a placeholder, not a real address: do not paste it in. If lib.rs and Anchor.toml ever drift apart, run anchor keys sync to line them back up.

Three defenses live in that small surface: has_one = authority ties the vault to its owner, the seeds plus bump pair proves the account is the real PDA and not a look-alike, and checked_sub refuses to underflow the balance. You will write one attack per defense.

2. Add the testing dependencies. In your program’s Cargo.toml, under [dev-dependencies]:

>[dev-dependencies]
>litesvm = "0.13.0"
>solana-sdk = "3.0"

One Anchor 1.0 requirement worth checking while you are in Cargo.toml: your workspace-root Cargo.toml must set overflow-checks = true under [profile.release]. anchor init adds this for you, so you only need to add it by hand if you assembled the workspace yourself.

3. Build a small harness. Adversarial tests share a lot of setup: spin up the VM, load your compiled program, fund some keypairs, and create a vault in a known-good state so each attack starts from a realistic position. Create tests/adversarial.rs in your program crate. The two Anchor traits, InstructionData and ToAccountMetas, let you build instructions directly from your program’s generated types instead of hand-assembling discriminators and account lists.

>use anchor_lang::{AccountSerialize, InstructionData, ToAccountMetas};
>use litesvm::LiteSVM;
>use solana_sdk::{
>    instruction::{Instruction, InstructionError},
>    pubkey::Pubkey,
>    signature::{Keypair, Signer},
>    transaction::{Transaction, TransactionError},
>};
>
>// Pull in your program crate so we can reuse its instruction
>// and account types. Replace `vault` with your crate name.
>use vault::{accounts, instruction, Vault};
>
>const PROGRAM_ID: Pubkey = vault::ID;
>
>/// Boot a VM with the program loaded and a funded payer.
>fn setup() -> (LiteSVM, Keypair) {
>    let mut svm = LiteSVM::new();
>    svm.add_program(
>        PROGRAM_ID,
>        include_bytes!("../../../target/deploy/vault.so"),
>    )
>    .unwrap();
>
>    let payer = Keypair::new();
>    svm.airdrop(&payer.pubkey(), 10_000_000_000).unwrap();
>    (svm, payer)
>}
>
>/// Place a vault account in a known state, owned by `authority`,
>/// at its canonical PDA, holding `balance`.
>fn seed_vault(svm: &mut LiteSVM, authority: &Pubkey, balance: u64) -> Pubkey {
>    let (vault_pda, _bump) =
>        Pubkey::find_program_address(&[b"vault", authority.as_ref()], &PROGRAM_ID);
>
>    let mut data = Vec::new();
>    // `Vault::try_serialize` writes the 8-byte discriminator AND the
>    // borsh-serialized struct, so do not prepend the discriminator again.
>    Vault { authority: *authority, balance }
>        .try_serialize(&mut data)
>        .unwrap();
>
>    let mut account = solana_sdk::account::Account {
>        lamports: 1_000_000_000,
>        data,
>        owner: PROGRAM_ID,
>        executable: false,
>        rent_epoch: 0,
>    };
>    // try_serialize produced exactly 8 + size_of::<Vault>() bytes;
>    // this truncate is a harmless safety net.
>    account.data.truncate(8 + std::mem::size_of::<Vault>());
>    svm.set_account(vault_pda, account).unwrap();
>
>    vault_pda
>}
>
>/// The one assertion that keeps adversarial tests honest:
>/// the transaction failed, AND it failed with the exact code we meant.
>fn assert_custom_error(
>    result: Result<impl std::fmt::Debug, litesvm::types::FailedTransactionMetadata>,
>    expected_code: u32,
>) {
>    let failure = result.expect_err("expected this transaction to fail, but it succeeded");
>    match failure.err {
>        TransactionError::InstructionError(_, InstructionError::Custom(code)) => {
>            assert_eq!(
>                code, expected_code,
>                "failed for the wrong reason: got code {code}, wanted {expected_code}"
>            );
>        }
>        other => panic!("expected a custom program error, got {other:?}"),
>    }
>}

4. Attack one: the wrong signer. The most common real-world exploit is an authorized action performed by an unauthorized caller. An attacker generates their own keypair, points the authority field at it, and signs the transaction themselves. They are a perfectly valid signer; they are just not the signer. Because the vault PDA is derived from authority.key(), passing a different signer makes Anchor re-derive a different address, so the seeds check rejects it first with ConstraintSeeds, code 2006.

>#[test]
>fn attacker_cannot_withdraw_with_wrong_authority() {
>    let (mut svm, _payer) = setup();
>
>    let real_owner = Keypair::new();
>    let attacker = Keypair::new();
>    svm.airdrop(&attacker.pubkey(), 1_000_000_000).unwrap();
>
>    // The vault belongs to real_owner.
>    let vault_pda = seed_vault(&mut svm, &real_owner.pubkey(), 500);
>
>    // The attacker submits a withdraw, claiming to be the authority.
>    let ix = Instruction {
>        program_id: PROGRAM_ID,
>        accounts: accounts::Withdraw {
>            vault: vault_pda,
>            authority: attacker.pubkey(),
>        }
>        .to_account_metas(None),
>        data: instruction::Withdraw { amount: 500 }.data(),
>    };
>
>    let tx = Transaction::new_signed_with_payer(
>        &[ix],
>        Some(&attacker.pubkey()),
>        &[&attacker],
>        svm.latest_blockhash(),
>    );
>
>    // 2006 = ConstraintSeeds. The vault PDA is derived from
>    // authority.key(), so a different signer derives a different
>    // address and the seeds check rejects it before has_one runs.
>    assert_custom_error(svm.send_transaction(tx), 2006);
>}

5. Attack two: the look-alike account. Here the attacker owns a vault of their own, derived from their own key, and tries to pass it where a different vault is expected, or passes any account that is not the canonical PDA for the seeds. The seeds plus bump constraint recomputes the expected address and compares. A mismatch returns ConstraintSeeds, code 2006.

>#[test]
>fn substituted_account_is_rejected_by_seeds() {
>    let (mut svm, _payer) = setup();
>
>    let owner = Keypair::new();
>    svm.airdrop(&owner.pubkey(), 1_000_000_000).unwrap();
>    let _real_vault = seed_vault(&mut svm, &owner.pubkey(), 500);
>
>    // A vault-shaped account at an address that is NOT the PDA
>    // for these seeds: a decoy the attacker controls.
>    let decoy = Keypair::new();
>    let mut data = Vec::new();
>    Vault { authority: owner.pubkey(), balance: 999 }
>        .try_serialize(&mut data)
>        .unwrap();
>    data.truncate(8 + std::mem::size_of::<Vault>());
>    svm.set_account(
>        decoy.pubkey(),
>        solana_sdk::account::Account {
>            lamports: 1_000_000_000,
>            data,
>            owner: PROGRAM_ID,
>            executable: false,
>            rent_epoch: 0,
>        },
>    )
>    .unwrap();
>
>    let ix = Instruction {
>        program_id: PROGRAM_ID,
>        accounts: accounts::Withdraw {
>            vault: decoy.pubkey(), // not the canonical PDA
>            authority: owner.pubkey(),
>        }
>        .to_account_metas(None),
>        data: instruction::Withdraw { amount: 999 }.data(),
>    };
>
>    let tx = Transaction::new_signed_with_payer(
>        &[ix],
>        Some(&owner.pubkey()),
>        &[&owner],
>        svm.latest_blockhash(),
>    );
>
>    // 2006 = ConstraintSeeds. The passed account is not the
>    // PDA these seeds derive.
>    assert_custom_error(svm.send_transaction(tx), 2006);
>}

6. Attack three: drain more than exists. Now the caller is legitimate but greedy. They own the vault, they sign correctly, and they ask to withdraw more than the balance. Without checked_sub, u64 subtraction would silently wrap to a gigantic number and your accounting would be ruined. Your arithmetic guard turns that into a clean, named failure: your own InsufficientFunds, which Anchor assigns custom code 6000 because it is the first variant in your error enum.

>#[test]
>fn overdraw_underflows_safely() {
>    let (mut svm, _payer) = setup();
>
>    let owner = Keypair::new();
>    svm.airdrop(&owner.pubkey(), 1_000_000_000).unwrap();
>    let vault_pda = seed_vault(&mut svm, &owner.pubkey(), 100);
>
>    let ix = Instruction {
>        program_id: PROGRAM_ID,
>        accounts: accounts::Withdraw {
>            vault: vault_pda,
>            authority: owner.pubkey(),
>        }
>        .to_account_metas(None),
>        data: instruction::Withdraw { amount: 1_000 }.data(), // more than 100
>    };
>
>    let tx = Transaction::new_signed_with_payer(
>        &[ix],
>        Some(&owner.pubkey()),
>        &[&owner],
>        svm.latest_blockhash(),
>    );
>
>    // 6000 = your VaultError::InsufficientFunds.
>    assert_custom_error(svm.send_transaction(tx), 6000);
>}

7. Confirm a real withdrawal still works. Adversarial tests prove the locks hold, but a locked door that never opens is also a bug. Keep one positive control alongside the attacks: the legitimate owner withdrawing a valid amount should succeed, and the balance should drop. If an over-eager constraint starts rejecting honest callers, this test catches it.

### Run it
>anchor build && cargo test --manifest-path programs/vault/Cargo.toml

You stopped asking your program to prove it works and started asking it to prove it cannot be abused. Each test took a single security assumption, built the exact malicious transaction that would violate it, and asserted that the runtime rejected it with the specific error code your defense is supposed to raise. That last detail is what separates a real security test from a comforting one. By checking for 2006 and 6000 rather than just “it failed,” you guaranteed that the constraint you care about is the thing doing the rejecting, not some unrelated mistake in your setup. (Notice that both of the first two attacks land on the same ConstraintSeeds code 2006: because the vault PDA is derived from authority.key(), a wrong signer fails the seeds check before has_one ever runs, so the seeds constraint is doing double duty here.)

This is the same instinct a backend engineer brings to a production API: you do not trust the client, so you write tests that send the malformed request, the forged token, and the out-of-range number, and you confirm the server says no in the way you designed. The difference on Solana is the stakes and the finality. There is no support ticket and no rollback after a withdrawal confirms, so the test suite is where you want every attack to land first. The vault here is a stand-in; the muscle you built is reusable on any instruction you ever write, especially the ones that move value or change authority.

One honest limit worth naming: these are hand-picked attacks. You imagined three specific abuses and proved your program survives them. An attacker you did not imagine is still out there. That gap is exactly what tomorrow’s work on property-based and fuzz testing is for, where the test framework generates the strange inputs you would never think to write by hand.

