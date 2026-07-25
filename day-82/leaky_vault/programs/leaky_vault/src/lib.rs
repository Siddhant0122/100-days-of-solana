
use anchor_lang::prelude::*;

declare_id!("AuKUbh57tQxtcpEaTdHqTq8dTNuDGiQmCzVxHhpeVcfv");

#[program]
pub mod leaky_vault {
    use super::*;

    pub fn withdraw(ctx: Context<Withdraw>, _amount: u64) -> Result<()> {
        require_keys_eq!(
            ctx.accounts.config.admin,
            ctx.accounts.signer.key(),
            VaultError::Unauthorized
        );
        msg!("withdraw authorized for {}", ctx.accounts.signer.key());
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Withdraw<'info> {
    // Account<T> checks the owner BEFORE deserializing. A System-owned
    // forgery is rejected with AccountOwnedByWrongProgram.
    pub config: Account<'info, Config>,
    #[account(mut)]
    pub signer: Signer<'info>,
}


#[account]
pub struct Config {
    pub admin: Pubkey,
}

#[error_code]
pub enum VaultError {
    #[msg("signer is not the admin")]
    Unauthorized,
}
