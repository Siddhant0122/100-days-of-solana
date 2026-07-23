use anchor_lang::prelude::*;
use anchor_spl::token_interface::{self, Mint, MintTo, TokenAccount, TokenInterface};

declare_id!("FyT1XmAwm7isPipjKA2QetPipCW3nR9m71wcgXnVXrMT"); // keep YOUR generated id

#[program]
pub mod token_cpi {
    use super::*;

    pub fn mint_tokens(ctx: Context<MintTokens>, amount: u64) -> Result<()> {
        // The accounts Token-2022 needs in order to mint.
        let cpi_accounts = MintTo {
            mint: ctx.accounts.mint.to_account_info(),
            to: ctx.accounts.token_account.to_account_info(),
            authority: ctx.accounts.signer.to_account_info(),
        };

        // The program we are calling into, and the context that ties it together.
        // In Anchor 1.0 the first arg to CpiContext::new is a Pubkey, so use .key().
        let cpi_program = ctx.accounts.token_program.key();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);

        // The cross-program invocation. amount is in base units.
        token_interface::mint_to(cpi_ctx, amount)?;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct MintTokens<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,
    #[account(mut)]
    pub mint: InterfaceAccount<'info, Mint>,
    #[account(mut)]
    pub token_account: InterfaceAccount<'info, TokenAccount>,
    pub token_program: Interface<'info, TokenInterface>,
}