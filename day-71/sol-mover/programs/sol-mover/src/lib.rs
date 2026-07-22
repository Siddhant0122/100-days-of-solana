
use anchor_lang::prelude::*;
use anchor_lang::system_program::{transfer, Transfer};

declare_id!("5VAw4s6Hj7CKDeLqWG7ysRM3aCu8Go4kYjrUPTG5VZYj"); // keep YOUR generated id, not this one

#[program]
pub mod sol_mover {
    use super::*;

    pub fn sol_transfer(ctx: Context<SolTransfer>, amount: u64) -> Result<()> {
        // Name the two accounts the System Program's transfer needs.
        let cpi_accounts = Transfer {
            from: ctx.accounts.sender.to_account_info(),
            to: ctx.accounts.recipient.to_account_info(),
        };

        // Bundle the target program with those accounts.
        let cpi_context = CpiContext::new(
            ctx.accounts.system_program.key(),
            cpi_accounts,
        );

        // Fire the cross-program invocation.
        transfer(cpi_context, amount)?;

        Ok(())
    }
}

#[derive(Accounts)]
pub struct SolTransfer<'info> {
    #[account(mut)]
    pub sender: Signer<'info>,
    #[account(mut)]
    pub recipient: SystemAccount<'info>,
    pub system_program: Program<'info, System>,
}
