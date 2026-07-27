use anchor_lang::prelude::*;

declare_id!("9B2iYVYP1SLNi9tn6p5j6zAm8ggDK9w2eYHvHi7g2Qqw");

#[program]
pub mod proof_of_ship {
    use super::*;

    pub fn ship(ctx: Context<Ship>, project_name: String, message: String) -> Result<()> {
        require!(project_name.len() <= 64, CapstoneError::NameTooLong);
        require!(message.len() <= 256, CapstoneError::MessageTooLong);

        let record = &mut ctx.accounts.ship_record;
        record.builder = ctx.accounts.builder.key();
        record.project_name = project_name;
        record.message = message;
        // Clock is Solana's built-in clock sysvar; this reads the current Unix timestamp
        record.shipped_at = Clock::get()?.unix_timestamp;
        record.bump = ctx.bumps.ship_record;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Ship<'info> {
    #[account(
        init,
        payer = builder,
        space = 8 + ShipRecord::INIT_SPACE,
        seeds = [b"ship", builder.key().as_ref()],
        bump
    )]
    pub ship_record: Account<'info, ShipRecord>,
    #[account(mut)]
    pub builder: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[account]
#[derive(InitSpace)]
pub struct ShipRecord {
    pub builder: Pubkey,
    #[max_len(64)]
    pub project_name: String,
    #[max_len(256)]
    pub message: String,
    pub shipped_at: i64,
    pub bump: u8,
}

#[error_code]
pub enum CapstoneError {
    #[msg("Project name must be 64 characters or fewer")]
    NameTooLong,
    #[msg("Message must be 256 characters or fewer")]
    MessageTooLong,
}
