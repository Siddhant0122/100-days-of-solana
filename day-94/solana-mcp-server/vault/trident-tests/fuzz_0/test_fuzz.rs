use fuzz_accounts::*;
use trident_fuzz::fuzzing::*;
mod fuzz_accounts;
mod types;
use types::*;

#[derive(FuzzTestMethods)]
struct FuzzTest {
    /// Trident client for interacting with the Solana program
    trident: Trident,
    /// Storage for all account addresses used in fuzz testing
    fuzz_accounts: AccountAddresses,
}

#[flow_executor]
impl FuzzTest {
    fn new() -> Self {
        Self {
            trident: Trident::default(),
            fuzz_accounts: AccountAddresses::default(),
        }
    }

    #[init]
    fn start(&mut self) {
        // Perform any initialization here, this method will be executed
        // at the start of each iteration
    }

    #[flow]
    fn deposit_never_shrinks(&mut self) {
        let authority = self.fuzz_accounts.authority.insert(&mut self.trident, None);
        self.trident.airdrop(&authority, 10_000_000_000);

        let (vault_pda, _) =
            Pubkey::find_program_address(&[b"vault", authority.as_ref()], &vault::program_id());

        let before = self.trident
            .get_account_with_type::<Vault>(&vault_pda, 8)
            .map(|v| v.balance)
            .unwrap_or(0);

        let amount = self.trident.random_from_range(0..1_000_000u64);

        let ix = vault::DepositInstruction::data(vault::DepositInstructionData::new(amount))
            .accounts(vault::DepositInstructionAccounts::new(vault_pda, authority))
            .instruction();
        self.trident.process_transaction(&[ix], Some("Deposit"));

        if let Some(v) = self.trident.get_account_with_type::<Vault>(&vault_pda, 8) {
            assert!(v.balance >= before, "deposit shrank the balance");
        }
    }

    #[end]
    fn end(&mut self) {
        // Perform any cleanup here, this method will be executed
        // at the end of each iteration
    }
}

fn main() {
    FuzzTest::fuzz(1000, 100);
}
