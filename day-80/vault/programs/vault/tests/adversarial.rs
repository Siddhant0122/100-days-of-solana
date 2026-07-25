use anchor_lang::{AccountSerialize, InstructionData, ToAccountMetas};
use litesvm::LiteSVM;
use solana_sdk::{
    instruction::{Instruction, InstructionError},
    pubkey::Pubkey,
    signature::{Keypair, Signer},
    transaction::{Transaction, TransactionError},
};

// Pull in your program crate so we can reuse its instruction
// and account types. Replace `vault` with your crate name.
use vault::{accounts, instruction, Vault};

const PROGRAM_ID: Pubkey = vault::ID;

/// Boot a VM with the program loaded and a funded payer.
fn setup() -> (LiteSVM, Keypair) {
    let mut svm = LiteSVM::new();
    svm.add_program(
        PROGRAM_ID,
        include_bytes!("../../../target/deploy/vault.so"),
    )
    .unwrap();

    let payer = Keypair::new();
    svm.airdrop(&payer.pubkey(), 10_000_000_000).unwrap();
    (svm, payer)
}

/// Place a vault account in a known state, owned by `authority`,
/// at its canonical PDA, holding `balance`.
fn seed_vault(svm: &mut LiteSVM, authority: &Pubkey, balance: u64) -> Pubkey {
    let (vault_pda, _bump) =
        Pubkey::find_program_address(&[b"vault", authority.as_ref()], &PROGRAM_ID);

    let mut data = Vec::new();
    // `Vault::try_serialize` writes the 8-byte discriminator AND the
    // borsh-serialized struct, so do not prepend the discriminator again.
    Vault { authority: *authority, balance }
        .try_serialize(&mut data)
        .unwrap();

    let mut account = solana_sdk::account::Account {
        lamports: 1_000_000_000,
        data,
        owner: PROGRAM_ID,
        executable: false,
        rent_epoch: 0,
    };
    // try_serialize produced exactly 8 + size_of::<Vault>() bytes;
    // this truncate is a harmless safety net.
    account.data.truncate(8 + std::mem::size_of::<Vault>());
    svm.set_account(vault_pda, account).unwrap();

    vault_pda
}

/// The one assertion that keeps adversarial tests honest:
/// the transaction failed, AND it failed with the exact code we meant.
fn assert_custom_error(
    result: Result<impl std::fmt::Debug, litesvm::types::FailedTransactionMetadata>,
    expected_code: u32,
) {
    let failure = result.expect_err("expected this transaction to fail, but it succeeded");
    match failure.err {
        TransactionError::InstructionError(_, InstructionError::Custom(code)) => {
            assert_eq!(
                code, expected_code,
                "failed for the wrong reason: got code {code}, wanted {expected_code}"
            );
        }
        other => panic!("expected a custom program error, got {other:?}"),
    }
}

#[test]
fn substituted_account_is_rejected_by_seeds() {
    let (mut svm, _payer) = setup();

    let owner = Keypair::new();
    svm.airdrop(&owner.pubkey(), 1_000_000_000).unwrap();
    let _real_vault = seed_vault(&mut svm, &owner.pubkey(), 500);

    // A vault-shaped account at an address that is NOT the PDA
    // for these seeds: a decoy the attacker controls.
    let decoy = Keypair::new();
    let mut data = Vec::new();
    Vault { authority: owner.pubkey(), balance: 999 }
        .try_serialize(&mut data)
        .unwrap();
    data.truncate(8 + std::mem::size_of::<Vault>());
    svm.set_account(
        decoy.pubkey(),
        solana_sdk::account::Account {
            lamports: 1_000_000_000,
            data,
            owner: PROGRAM_ID,
            executable: false,
            rent_epoch: 0,
        },
    )
    .unwrap();

    let ix = Instruction {
        program_id: PROGRAM_ID,
        accounts: accounts::Withdraw {
            vault: decoy.pubkey(), // not the canonical PDA
            authority: owner.pubkey(),
        }
        .to_account_metas(None),
        data: instruction::Withdraw { amount: 999 }.data(),
    };

    let tx = Transaction::new_signed_with_payer(
        &[ix],
        Some(&owner.pubkey()),
        &[&owner],
        svm.latest_blockhash(),
    );

    // 2006 = ConstraintSeeds. The passed account is not the
    // PDA these seeds derive.
    assert_custom_error(svm.send_transaction(tx), 2006);
}

#[test]
fn attacker_cannot_withdraw_with_wrong_authority() {
    let (mut svm, _payer) = setup();

    let real_owner = Keypair::new();
    let attacker = Keypair::new();
    svm.airdrop(&attacker.pubkey(), 1_000_000_000).unwrap();

    // The vault belongs to real_owner.
    let vault_pda = seed_vault(&mut svm, &real_owner.pubkey(), 500);

    // The attacker submits a withdraw, claiming to be the authority.
    let ix = Instruction {
        program_id: PROGRAM_ID,
        accounts: accounts::Withdraw {
            vault: vault_pda,
            authority: attacker.pubkey(),
        }
        .to_account_metas(None),
        data: instruction::Withdraw { amount: 500 }.data(),
    };

    let tx = Transaction::new_signed_with_payer(
        &[ix],
        Some(&attacker.pubkey()),
        &[&attacker],
        svm.latest_blockhash(),
    );

    // 2006 = ConstraintSeeds. The vault PDA is derived from
    // authority.key(), so a different signer derives a different
    // address and the seeds check rejects it before has_one runs.
    assert_custom_error(svm.send_transaction(tx), 2006);
}

#[test]
fn overdraw_underflows_safely() {
    let (mut svm, _payer) = setup();

    let owner = Keypair::new();
    svm.airdrop(&owner.pubkey(), 1_000_000_000).unwrap();
    let vault_pda = seed_vault(&mut svm, &owner.pubkey(), 100);

    let ix = Instruction {
        program_id: PROGRAM_ID,
        accounts: accounts::Withdraw {
            vault: vault_pda,
            authority: owner.pubkey(),
        }
        .to_account_metas(None),
        data: instruction::Withdraw { amount: 1_000 }.data(), // more than 100
    };

    let tx = Transaction::new_signed_with_payer(
        &[ix],
        Some(&owner.pubkey()),
        &[&owner],
        svm.latest_blockhash(),
    );

    // 6000 = your VaultError::InsufficientFunds.
    assert_custom_error(svm.send_transaction(tx), 6000);
}