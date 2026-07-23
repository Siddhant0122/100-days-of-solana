## Mint Token-2022 tokens from inside your program

New tokens do not come from nowhere. Somewhere a program holding mint authority calls into the token program, asks it to create some units, and the supply ticks up. So far you have only made that request from the command line with the SPL Token CLI. Today your own Anchor program makes it instead.

The instruction you wrote in the previous challenge reached across to the System Program and asked it to move SOL. Today the program you call changes from the System Program to Token-2022, and the job changes from moving lamports to minting tokens. The mechanics, though, are the ones you already know: build a set of accounts, wrap them in a CpiContext, and hand it to a helper that does the cross-program invocation for you.

Here is the useful way to picture it. A cross-program invocation is one service calling another service’s API. Your program is the caller. Token-2022 is the service that owns the “create new tokens” endpoint, and that endpoint has an access rule: only the mint authority is allowed to call it. So your instruction has to carry the mint authority’s signature through to Token-2022. Today the mint authority is a plain wallet that signs the transaction, which keeps the call simple. In the next challenge you will make a PDA the authority and sign on its behalf, but that is tomorrow’s problem.

## Steps

>anchor init token_cpi
>cd token_cpi
>rm -rf programs/token_cpi/tests   # remove the scaffolded Rust test that references the deleted initialize instruction

1. Open programs/token_cpi/Cargo.toml and replace the existing [dependencies] block with these two lines so the program can use anchor-spl’s token interface:

>[dependencies]
>anchor-lang = "1.0"
>anchor-spl = { version = "1.0", features = ["idl-build"] }

If you are on Anchor 0.31.x, use "0.31.1" for both crates and add anchor-spl/idl-build to the idl-build feature list in [features].

2. Now replace programs/token_cpi/src/lib.rs with this handler. Keep the declare_id! line Anchor generated for you. Only the body changes.

>use anchor_lang::prelude::*;
>use anchor_spl::token_interface::{self, Mint, MintTo, TokenAccount, TokenInterface};
>
>declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS"); // keep YOUR generated id
>
>#[program]
>pub mod token_cpi {
>    use super::*;
>
>    pub fn mint_tokens(ctx: Context<MintTokens>, amount: u64) -> Result<()> {
>        // The accounts Token-2022 needs in order to mint.
>        let cpi_accounts = MintTo {
>            mint: ctx.accounts.mint.to_account_info(),
>            to: ctx.accounts.token_account.to_account_info(),
>            authority: ctx.accounts.signer.to_account_info(),
>        };
>
>        // The program we are calling into, and the context that ties it together.
>        // In Anchor 1.0 the first arg to CpiContext::new is a Pubkey, so use .key().
>        let cpi_program = ctx.accounts.token_program.key();
>        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
>
>        // The cross-program invocation. amount is in base units.
>        token_interface::mint_to(cpi_ctx, amount)?;
>        Ok(())
>    }
>}
>
>#[derive(Accounts)]
>pub struct MintTokens<'info> {
>    #[account(mut)]
>    pub signer: Signer<'info>,
>    #[account(mut)]
>    pub mint: InterfaceAccount<'info, Mint>,
>    #[account(mut)]
>    pub token_account: InterfaceAccount<'info, TokenAccount>,
>    pub token_program: Interface<'info, TokenInterface>,
>}

A few things worth naming. MintTo is the accounts struct that the token program’s mint instruction expects: the mint to grow, the token account to receive the new units, and the authority allowed to do it. InterfaceAccount and Interface are the Token-2022 aware versions of Anchor’s account types, so the very same program would also work against the original Token Program without a rewrite. And notice that nothing here checks a signature by hand. Because signer is the mint authority and it signs the outer transaction, that signature flows through into the CPI automatically.

3. Build the program once so Anchor generates the IDL and TypeScript types your test will import:

> anchor build

Anchor 1.0 does not auto-create a TypeScript test directory, so make one. The Anchor 1.0 JS client (@anchor-lang/core) already ships with the scaffold, so you only need to add @solana/spl-token for the mint helpers:

>mkdir tests
>yarn add --dev @solana/spl-token

4. Create tests/token_cpi.ts with these imports at the top:

>import * as anchor from "@anchor-lang/core";
>import { Program } from "@anchor-lang/core";
>import { TokenCpi } from "../target/types/token_cpi";
>import { strict as assert } from "assert";
>import {
>  TOKEN_2022_PROGRAM_ID,
>  createMint,
>  getOrCreateAssociatedTokenAccount,
>  getAccount,
>} from "@solana/spl-token";

5. Then add the body of the test: a describe block, the provider setup, the program variable, and the it(...) block that actually exercises the CPI.

>describe("token_cpi", () => {
>  const provider = anchor.AnchorProvider.env();
>  anchor.setProvider(provider);
>
>  const program = anchor.workspace.TokenCpi as Program<TokenCpi>;
>
>  it("mints Token-2022 tokens through the program", async () => {
>    const payer = (provider.wallet as anchor.Wallet).payer;
>    const connection = provider.connection;
>
>    // 1. Create a Token-2022 mint. Your wallet is the mint authority.
>    const mint = await createMint(
>      connection,
>      payer,
>      payer.publicKey, // mint authority
>      null,            // no freeze authority
>      9,               // decimals
>      undefined,
>      undefined,
>      TOKEN_2022_PROGRAM_ID,
>    );
>
>    // 2. Create the destination token account your wallet owns.
>    const ata = await getOrCreateAssociatedTokenAccount(
>      connection,
>      payer,
>      mint,
>      payer.publicKey,
>      false,
>      undefined,
>      undefined,
>      TOKEN_2022_PROGRAM_ID,
>    );
>
>    // 3. Ask YOUR program to mint. It runs the mint_to CPI for you.
>    const amount = new anchor.BN(1_000_000_000); // 1 whole token at 9 decimals
>    await program.methods
>      .mintTokens(amount)
>      .accountsPartial({
>        signer: payer.publicKey,
>        mint,
>        tokenAccount: ata.address,
>        tokenProgram: TOKEN_2022_PROGRAM_ID,
>      })
>      .rpc();
>
>    // 4. Read the balance straight from the chain.
>    const account = await getAccount(connection, ata.address, undefined, TOKEN_2022_PROGRAM_ID);
>    console.log("Minted base units:", account.amount.toString());
>    assert.equal(account.amount.toString(), amount.toString());
>  });
>});

The first two steps are ordinary setup: a mint exists, and a token account exists to hold the result. Step three is the whole point of the day. Instead of asking Token-2022 to mint directly, you call mintTokens on your program, and your program turns around and makes the CPI. The tokenProgram account you pass in is what your handler reads as ctx.accounts.token_program, which is how the same code can target Token-2022 here and the classic Token Program elsewhere.

### Run it

Wire the mocha runner into Anchor.toml (replacing the default cargo test script) so anchor test actually executes your TypeScript file:

>[scripts]
>test = "yarn run ts-mocha -p ./tsconfig.json -t 1000000 tests/**/*.ts"

anchor test then spins up surfpool, which already has Token-2022 and the Associated Token Account program loaded, deploys your program, and runs the test.

>anchor test

A passing run prints the minted balance and the green check for your test. Seeing Minted base units: 1000000000 means your program just created one whole token through a cross-program invocation.

