
use anchor_lang::prelude::*;

declare_id!("7f4CH3nHNWiD3n9BDF3998356TKQXx5wuYSS4hGbrZTJ"); // keep the id anchor generated for you

#[program]
pub mod counter {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        ctx.accounts.tally.count = 0;
        Ok(())
    }

    pub fn increment(ctx: Context<Increment>) -> Result<()> {
        ctx.accounts.tally.count += 1;
        msg!("counter is now {}", ctx.accounts.tally.count);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(init, payer = payer, space = 8 + Tally::INIT_SPACE)]
    pub tally: Account<'info, Tally>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Increment<'info> {
    #[account(mut)]
    pub tally: Account<'info, Tally>,
}

#[account]
#[derive(InitSpace)]
pub struct Tally {
    pub count: u64,
}
