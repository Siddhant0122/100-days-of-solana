## Withdraw SOL from a vault your program signs for

A program derived address has no private key. No one can produce a signature for it, not even you. Yet by the end of today your program will move SOL out of one, and the runtime will accept the transfer as fully authorized.

On the day you moved SOL with a CPI, a human signed the transaction and that signature flowed into the inner transfer. When you minted tokens from inside your program, a real authority signed again. Every cross-program call so far has had a keypair standing behind it.

Today the source of the funds is a program derived address: a vault that belongs to your program and has no key at all. So who authorizes the withdrawal? Your program does, by handing the runtime the exact seeds used to derive the vault. Think of it the way a backend service acts under its own service-account identity instead of borrowing a user’s password. The service never holds a secret for that identity; it proves control by reconstructing the identity from inputs only it can present. That is precisely what a PDA-signed CPI is, and it is the move that lets a program custody and release assets on a user’s behalf.

You will give your program two instructions. deposit lets a user fund a vault PDA derived from their own public key. withdraw sends that SOL back out, and because the vault has no private key, your program signs the transfer for it using the vault’s seeds and bump.

### Steps
1. Write the two instructions. Open your program’s lib.rs. Keep the declare_id! line that Anchor already generated for your project (do not copy the placeholder below), and add the deposit and withdraw handlers. Notice the one difference that matters: deposit uses a plain CpiContext::new because the user already signed, while withdraw chains .with_signer(...) because the vault cannot sign for itself.

>use anchor_lang::prelude::*;
>use anchor_lang::system_program::{transfer, Transfer};
>
>declare_id!("YOUR_PROGRAM_ID_HERE"); // keep the id Anchor generated for your project
>
>#[program]
>pub mod vault {
>    use super::*;
>
>    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
>        // The user signed the outer transaction, so a plain CPI is enough.
>        // Anchor 1.0's CpiContext::new takes the program's Pubkey (`.key()`),
>        // not its AccountInfo, so use `.key()` here and on every CpiContext::new.
>        let cpi_ctx = CpiContext::new(
>            ctx.accounts.system_program.key(),
>            Transfer {
>                from: ctx.accounts.user.to_account_info(),
>                to: ctx.accounts.vault.to_account_info(),
>            },
>        );
>        transfer(cpi_ctx, amount)?;
>        Ok(())
>    }
>
>    pub fn withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
>        let user_key = ctx.accounts.user.key();
>        let bump = ctx.bumps.vault;
>
>        // The recipe for the vault: literal seed, owner key, canonical bump.
>        let signer_seeds: &[&[&[u8]]] = &[&[b"vault", user_key.as_ref(), &[bump]]];
>
>        // The vault has no private key, so the program signs for it.
>        let cpi_ctx = CpiContext::new(
>            ctx.accounts.system_program.key(),
>            Transfer {
>                from: ctx.accounts.vault.to_account_info(),
>                to: ctx.accounts.user.to_account_info(),
>            },
>        )
>        .with_signer(signer_seeds);
>
>        transfer(cpi_ctx, amount)?;
>        Ok(())
>    }
>}

2. Describe the accounts. Both instructions use the same vault PDA, derived from the literal b"vault" and the user’s public key. The vault is a SystemAccount: it is owned by the System Program and holds only lamports, which is exactly what lets the System Program move SOL back out of it later. The user is marked mut in both structs because their balance changes, and a Signer so that only the vault’s owner can deposit to or drain their own vault.

>#[derive(Accounts)]
>pub struct Deposit<'info> {
>    #[account(mut)]
>    pub user: Signer<'info>,
>
>    #[account(
>        mut,
>        seeds = [b"vault", user.key().as_ref()],
>        bump,
>    )]
>    pub vault: SystemAccount<'info>,
>
>    pub system_program: Program<'info, System>,
>}
>
>#[derive(Accounts)]
>pub struct Withdraw<'info> {
>    #[account(mut)]
>    pub user: Signer<'info>,
>
>    #[account(
>        mut,
>        seeds = [b"vault", user.key().as_ref()],
>        bump,
>    )]
>    pub vault: SystemAccount<'info>,
>
>    pub system_program: Program<'info, System>,
>}

The seeds and bump on the account constraint tell Anchor how to find and validate the vault, and they give you ctx.bumps.vault for free: the canonical bump you fed into signer_seeds above. The two have to match, because the runtime will re-derive the address from exactly those pieces.

3. Drive it from a test. Anchor 1.0 does not auto-create a tests/ directory, so make one. Everything this test imports — the Anchor 1.0 JS client (@anchor-lang/core) and chai — already ships with the scaffold, so there’s nothing extra to install:

>mkdir tests

Put the following in tests/vault.ts. It deposits half a SOL, prints the vault balance, then withdraws the same amount and asserts the vault has been emptied. The vault address is derived in TypeScript with the same seeds you used on chain.

>import * as anchor from "@anchor-lang/core";
>import { Program, web3 } from "@anchor-lang/core";
>import { Vault } from "../target/types/vault";
>import { assert } from "chai";
>
>const { PublicKey, SystemProgram, LAMPORTS_PER_SOL } = web3;
>
>describe("vault", () => {
>  const provider = anchor.AnchorProvider.env();
>  anchor.setProvider(provider);
>
>  const program = anchor.workspace.Vault as Program<Vault>;
>  const user = provider.wallet.publicKey;
>
>  const [vault] = PublicKey.findProgramAddressSync(
>    [Buffer.from("vault"), user.toBuffer()],
>    program.programId
>  );
>
>  it("deposits, then the program signs to withdraw", async () => {
>    const amount = new anchor.BN(0.5 * LAMPORTS_PER_SOL);
>
>    await program.methods
>      .deposit(amount)
>      .accountsPartial({ user, vault, systemProgram: SystemProgram.programId })
>      .rpc();
>
>    console.log("vault after deposit:", await provider.connection.getBalance(vault));
>
>    await program.methods
>      .withdraw(amount)
>      .accountsPartial({ user, vault, systemProgram: SystemProgram.programId })
>      .rpc();
>
>    const finalBalance = await provider.connection.getBalance(vault);
>    console.log("vault after withdraw:", finalBalance);
>    assert.equal(finalBalance, 0);
>  });
>});

One detail worth knowing: since Anchor 0.30, the typed client resolves PDAs, signers, and the System Program for you, so passing them through the plain .accounts(...) method causes a type error. Use .accountsPartial(...) when you want to list those accounts explicitly, as we do here for clarity.

Finally, change the default [scripts] test in Anchor.toml so anchor test runs the mocha file instead of cargo test:

>[scripts]
>test = "yarn run ts-mocha -p ./tsconfig.json -t 1000000 tests/**/*.ts"

### Run it
>anchor build
>anchor test

The deposit transfer needed no signer seeds: the user signed the outer transaction, and that signature carried into the inner call. The withdraw transfer was different. Calling .with_signer(signer_seeds) tells Anchor to use the runtime’s invoke_signed instead of a plain invoke, and you handed it the exact recipe for the vault: the literal seed b"vault", the owner’s public key, and the canonical bump.

When the inner transfer ran, the runtime took those seeds together with your program’s id and re-derived an address. Because the derived address matched the vault account in the instruction, the runtime treated the vault as a signer for the length of that one CPI, and no longer. This is why the seeds are not a secret: anyone can read them. The security comes from your program’s id being mixed into the derivation, so only your program can ever produce a valid signature for that PDA. No other program, and no person holding a keypair, can stand in for it.

There is one rule that bit a lot of people the first time, so it is worth saying now. You withdrew the full balance, the vault dropped to zero lamports, and the runtime reclaimed the account cleanly. Had you left a few lamports behind, below the rent-exempt minimum, the transfer would have failed instead: a System-owned account must either stay rent-exempt or go all the way to zero. You have just built the on-chain version of a service acting under its own identity. Your program custodied a user’s SOL in an address that never had a key, and released it on command by proving, with nothing but a recipe, that the identity was its to control.