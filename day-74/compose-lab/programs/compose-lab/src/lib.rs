
use anchor_lang::prelude::*;

declare_program!(counter);

use counter::{
    accounts::Tally,
    cpi::{self, accounts::Increment},
    program::Counter,
};

declare_id!("Db3YaBMwv3ecptcJa9aeTTJq2bznZWaHTBmrUyMgbWqt"); // keep the id anchor generated for you

#[program]
pub mod compose_lab {
    use super::*;

    pub fn bump(ctx: Context<Bump>) -> Result<()> {
        let cpi_ctx = CpiContext::new(
            ctx.accounts.counter_program.key(),
            Increment {
                tally: ctx.accounts.tally.to_account_info(),
            },
        );
        cpi::increment(cpi_ctx)?;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Bump<'info> {
    #[account(mut)]
    pub tally: Account<'info, Tally>,
    pub counter_program: Program<'info, Counter>,
}
