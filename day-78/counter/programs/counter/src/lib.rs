use anchor_lang::prelude::*;

declare_id!("HCkd67EFgP4JHHsYwJy6aN9VW4QPJMDR5bCmvkmJC7uF");

#[program]
pub mod counter {
    use super::*;

    pub fn init_counter(ctx: Context<InitCounter>) -> Result<()> {
        let counter = &mut ctx.accounts.counter;
        counter.user = ctx.accounts.user.key();
        counter.count = 0;
        counter.bump = ctx.bumps.counter;

        let config = &mut ctx.accounts.config;
        config.total_counters = config.total_counters.checked_add(1).unwrap();
        Ok(())
    }

    pub fn increment(ctx: Context<Increment>) -> Result<()> {
        let counter = &mut ctx.accounts.counter;
        counter.count = counter
            .count
            .checked_add(1)
            .ok_or(CounterError::Overflow)?;
        Ok(())
    }

    pub fn set_paused(ctx: Context<SetPaused>, paused: bool) -> Result<()> {
        ctx.accounts.config.paused = paused;
        Ok(())
    }

    pub fn init_config(ctx: Context<InitConfig>) -> Result<()> {
        let config = &mut ctx.accounts.config;
        config.admin = ctx.accounts.admin.key();
        config.paused = false;
        config.total_counters = 0;
        config.bump = ctx.bumps.config;
        Ok(())
    }

    pub fn close_counter(_ctx: Context<CloseCounter>) -> Result<()> {
        Ok(())
    }

}

#[derive(Accounts)]
pub struct InitCounter<'info> {
    #[account(
        mut, 
        seeds = [b"config"],
        bump = config.bump,
    )]
    pub config: Account<'info, Config>,
    #[account(
        init,
        payer = user,
        space = 8 + Counter::INIT_SPACE,
        seeds = [b"counter", user.key().as_ref()],
        bump,
    )]
    pub counter: Account<'info, Counter>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Increment<'info> {
    #[account(
        mut,
        seeds = [b"counter", user.key().as_ref()],
        bump = counter.bump,
    )]
    pub counter: Account<'info, Counter>,
    pub user: Signer<'info>,
}

#[account]
#[derive(InitSpace)]
pub struct Counter {
    pub user: Pubkey,
    pub count: u64,
    pub bump: u8,
}

#[error_code]
pub enum CounterError {
    #[msg("counter overflow")]
    Overflow,
    #[msg("Increments are currently paused")]
    Paused,
}

#[account]
#[derive(InitSpace)]
pub struct Config {
    pub admin: Pubkey,
    pub paused: bool,
    pub total_counters: u64,
    pub bump: u8,
}


#[derive(Accounts)]
pub struct InitConfig<'info>{
    #[account(
        init,
        payer = admin,
        space = 8 + Config::INIT_SPACE,
        seeds = [b"config"],
        bump
    )]
    pub config: Account<'info, Config>,
    #[account(mut)]
    pub admin: Signer<'info>,
    pub system_program: Program<'info, System>,
}


#[derive(Accounts)]
pub struct SetPaused<'info>{
    #[account(
        mut,
        seeds = [b"config"],
        bump = config.bump,
        has_one = admin,
    )]
    pub config: Account<'info, Config>,
    pub admin: Signer<'info>,
}

#[derive(Accounts)]
pub struct CloseCounter<'info> {
    #[account(
        mut,
        close = user,
        seeds = [b"counter", user.key().as_ref()],
        bump = counter.bump,
        has_one = user,
    )]
    pub counter: Account<'info, Counter>,
    #[account(mut)]
    pub user: Signer<'info>,
}

#[derive(Accounts)]
pub struct UpdateProfile<'info> {
    #[account(mut, has_one = authority)]
    pub profile: Account<'info, Profile>,

    /// CHECK: compared to profile.authority via has_one
    pub authority: UncheckedAccount<'info>,
}

