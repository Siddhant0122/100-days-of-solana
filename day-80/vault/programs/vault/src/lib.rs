use anchor_lang::prelude::*;

declare_id!("E2U5Pu9fBfnf5WniSTHt2S3qihQf5vtm2jJB9Vytdrdq");

#[program]
pub mod vault {
    use super::*;

    pub fn withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
        let vault = &mut ctx.accounts.vault;

        // Arithmetic safety: refuse to underflow instead of wrapping.
        vault.balance = vault
            .balance
            .checked_sub(amount)
            .ok_or(VaultError::InsufficientFunds)?;

        Ok(())
    }
}

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(
        mut,
        seeds = [b"vault", authority.key().as_ref()],
        bump,
        has_one = authority,
    )]
    pub vault: Account<'info, Vault>,
    pub authority: Signer<'info>,
}

#[account]
pub struct Vault {
    pub authority: Pubkey,
    pub balance: u64,
}

#[error_code]
pub enum VaultError {
    #[msg("Withdrawal exceeds vault balance")]
    InsufficientFunds, // Anchor assigns this custom code 6000
}
