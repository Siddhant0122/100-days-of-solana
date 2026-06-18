use anchor_lang::{
    solana_program::system_program,
    AccountDeserialize, InstructionData, ToAccountMetas,
};
use counter::{accounts as counter_accounts, instruction as counter_instruction, Counter};
use litesvm::LiteSVM;
use solana_instruction::Instruction;
use solana_keypair::Keypair;
use solana_signer::Signer;
use solana_transaction::Transaction;

#[test]
fn intialize_sets_count_to_zero(){
    let mut svm = LiteSVM::new();

    let payer = Keypair::new();
    svm.airdrop(&payer.pubkey(), 10*1_000_000_000).unwrap();

    let program_id = counter::ID;
    let so_path = concat!(env!("CARGO_MANIFEST_DIR"), "/../../target/deploy/counter.so");
    svm.add_program_from_file(program_id, so_path).unwrap();

    let counter_kp = Keypair::new();

    let ix = Instruction{
        program_id,
        accounts: counter_accounts::Initialize{
            counter: counter_kp.pubkey(),
            authority: payer.pubkey(),
            system_program: system_program::ID,
        }
        .to_account_metas(None),
        data: counter_instruction::Initialize {}.data(),
    };

    let tx = Transaction::new_signed_with_payer(
        &[ix],
        Some(&payer.pubkey()),
        &[&payer, &counter_kp],
        svm.latest_blockhash(),
    );

    svm.send_transaction(tx).expect("initialize should succeed");

    let raw = svm.get_account(&counter_kp.pubkey()).expect("counter exists");
    let state = Counter::try_deserialize(&mut raw.data.as_slice()).unwrap();

    assert_eq!(state.count, 0);
    assert_eq!(state.authority, payer.pubkey());
}