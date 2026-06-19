use anchor_lang::{
    solana_program::system_program,
    AccountDeserialize, InstructionData, ToAccountMetas,
};
use litesvm::LiteSVM;
use solana_instruction::Instruction;
use solana_keypair::Keypair;
use solana_signer::Signer;
use solana_transaction::Transaction;

#[test]
fn initialize_then_increment() {
    let mut svm = LiteSVM::new();
    let program_id = counter::ID;
    let so_path = concat!(env!("CARGO_MANIFEST_DIR"), "/../../target/deploy/counter.so");
    svm.add_program_from_file(program_id, so_path).unwrap();

    let authority = Keypair::new();
    svm.airdrop(&authority.pubkey(), 1_000_000_000).unwrap();
    let counter_kp = Keypair::new();

    // 1) initialize
    let init_ix = Instruction {
        program_id,
        accounts: counter::accounts::Initialize {
            counter: counter_kp.pubkey(),
            authority: authority.pubkey(),
            system_program: system_program::ID,
        }
        .to_account_metas(None),
        data: counter::instruction::Initialize {}.data(),
    };
    let bh = svm.latest_blockhash();
    let tx = Transaction::new_signed_with_payer(
        &[init_ix],
        Some(&authority.pubkey()),
        &[&authority, &counter_kp],
        bh,
    );
    svm.send_transaction(tx).unwrap();

    // 2) increment
    let inc_ix = Instruction {
        program_id,
        accounts: counter::accounts::Increment {
            counter: counter_kp.pubkey(),
            authority: authority.pubkey(),
        }
        .to_account_metas(None),
        data: counter::instruction::Increment {}.data(),
    };
    let bh = svm.latest_blockhash();
    let tx = Transaction::new_signed_with_payer(
        &[inc_ix],
        Some(&authority.pubkey()),
        &[&authority],
        bh,
    );
    svm.send_transaction(tx).unwrap();

    // 3) read and assert
    let account = svm.get_account(&counter_kp.pubkey()).unwrap();
    let parsed = counter::Counter::try_deserialize(&mut account.data.as_slice()).unwrap();
    assert_eq!(parsed.count, 1);
    assert_eq!(parsed.authority, authority.pubkey());
}
