## Rebuild the $326M Wormhole bug yourself

Three hundred and twenty-six million dollars (120,000 wrapped ETH) left the Wormhole bridge on February 2, 2022, and the root cause fits in a single sentence: the program trusted an account without ever checking what that account actually was. Weeks later the same class of bug let an attacker mint roughly two billion fake CASH tokens out of Cashio, draining about $52 million. Different protocols, different dollar amounts, identical mistake. Today you are going to rebuild that mistake on purpose, in miniature, and watch it pay out on your own machine.

This is an Experiment day, so the goal is not a polished feature. It is a controlled detonation. You will write a deliberately vulnerable program, craft the transaction that exploits it, confirm the theft succeeds, then apply the one-line fix and watch the same transaction get rejected. Reproducing an exploit yourself turns a scary headline into a mechanism you can see, step through, and defend against.

Incident responders rarely trust a written post-mortem on its own. When a serious bug lands, the first thing a good security team does is reproduce it in a sandbox: stand up a local copy of the vulnerable code, replay the attacker’s transaction, and confirm they understand the mechanism before they trust any fix. A bug you cannot reproduce is a bug you cannot prove you have closed.

Both Wormhole and Cashio fell to the same family of vulnerability, the one this arc has been circling for a week: an account was accepted and read without verifying its owner. On Solana, every account records which program owns it. Your program’s own state accounts are owned by your program. A garbage account that an attacker created and filled with whatever bytes they like is owned by the System Program (or some program of their choosing). If your handler reads an account’s data without checking that owner field, an attacker can hand you a forgery that deserializes perfectly and says exactly what they want it to say. Wormhole trusted a forged instructions sysvar; Cashio trusted a collateral account whose backing was never validated. You are going to reproduce the smallest honest version of that bug.

### Steps
1. Read the root cause before you write a line. Skim one Wormhole post-mortem and note the single deprecated call at the center of it: the contract used load_instruction_at, which read the instructions sysvar without verifying the account’s address. The fix shipped by the team was to switch to load_instruction_at_checked. Generalize that to a rule you can reuse: never read an account’s contents until you have confirmed its identity. That is the exact rule you closed with Anchor constraints three days ago, now seen from the attacker’s side.

2. caffold a throwaway project and write the vulnerable program. Start clean so nothing else is in the way:

>anchor init leaky_vault
>cd leaky_vault

Delete the default test Anchor generated, programs/leaky_vault/tests/test_initialize.rs — it references a no-op initialize and will not compile against this code. Then replace programs/leaky_vault/src/lib.rs with a tiny “vault” whose withdraw instruction is allowed only for an admin recorded in a Config account. The bug is that config comes in as an UncheckedAccount and is deserialized by hand, so the program never confirms the account is one it actually owns.

>use anchor_lang::prelude::*;
>
>declare_id!("REPLACE_WITH_YOUR_DECLARED_ID");
>
>#[program]
>pub mod leaky_vault {
>    use super::*;
>
>    pub fn withdraw(ctx: Context<Withdraw>, _amount: u64) -> Result<()> {
>        // VULNERABLE: we read this account's bytes without ever checking
>        // who owns it. Anything that deserializes is treated as our Config.
>        let data = ctx.accounts.config.try_borrow_data()?;
>        let config = Config::try_deserialize(&mut &data[..])?;
>
>        require_keys_eq!(
>            config.admin,
>            ctx.accounts.signer.key(),
>            VaultError::Unauthorized
>        );
>
>        // Real withdraw logic would move lamports here. For the experiment,
>        // reaching this line at all is the exploit: auth has been bypassed.
>        msg!("withdraw authorized for {}", ctx.accounts.signer.key());
>        Ok(())
>    }
>}
>
>#[derive(Accounts)]
>pub struct Withdraw<'info> {
>    /// CHECK: deserialized by hand below, with no owner check. This is the bug.
>    pub config: UncheckedAccount<'info>,
>    #[account(mut)]
>    pub signer: Signer<'info>,
>}
>
>#[account]
>pub struct Config {
>    pub admin: Pubkey,
>}
>
>#[error_code]
>pub enum VaultError {
>    #[msg("signer is not the admin")]
>    Unauthorized,
>}

Use the program ID Anchor generated when you scaffolded this project. The REPLACE_WITH_YOUR_DECLARED_ID above is a placeholder, not a real address: keep your own ID, and run anchor keys sync if lib.rs and Anchor.toml ever disagree. Anchor 1.0 also expects overflow-checks = true under [profile.release] in your workspace-root Cargo.toml, which anchor init sets for you.

Anchor scaffolds a set of granular test crates under [dev-dependencies] in programs/leaky_vault/Cargo.toml. Replace them with the two this experiment uses:

>[dev-dependencies]
>litesvm = "0.13.0"
>solana-sdk = "3.0"

3. Forge the account and fire the attack in LiteSVM. This is the heart of the experiment. LiteSVM lets you write any bytes into any address with set_account, which is precisely the power an attacker has when they create their own account on a real cluster. You build a Config whose admin is the attacker’s pubkey, store it in an account owned by the System Program, and pass it in. Because the program never checks the owner, the forgery sails through. Create programs/leaky_vault/tests/attack.rs. It boots LiteSVM, loads your compiled program, forges a Config, and fires — all inside a named #[test] so cargo test attack_drains_vault can find it:

>use anchor_lang::solana_program::system_program;
>use anchor_lang::{Discriminator, InstructionData};
>use litesvm::LiteSVM;
>use solana_sdk::{
>    account::Account,
>    instruction::{AccountMeta, Instruction},
>    pubkey::Pubkey,
>    signature::{Keypair, Signer},
>    transaction::Transaction,
>};
>
>use leaky_vault::Config;
>
>/// Boot a VM with the compiled program loaded.
>fn setup() -> LiteSVM {
>    let mut svm = LiteSVM::new();
>    svm.add_program(
>        leaky_vault::ID,
>        include_bytes!("../../../target/deploy/leaky_vault.so"),
>    )
>    .unwrap();
>    svm
>}
>
>#[test]
>fn attack_drains_vault() {
>    let mut svm = setup();
>
>    // `Config::DISCRIMINATOR` is public, so an attacker can prepend the
>    // same 8 bytes Anchor uses. The forged account deserializes cleanly.
>    let attacker = Keypair::new();
>    svm.airdrop(&attacker.pubkey(), 1_000_000_000).unwrap();
>
>    let mut forged_data = Vec::new();
>    forged_data.extend_from_slice(Config::DISCRIMINATOR);
>    forged_data.extend_from_slice(attacker.pubkey().as_ref()); // admin = attacker
>
>    let fake_config = Pubkey::new_unique();
>    svm.set_account(
>        fake_config,
>        Account {
>            lamports: 1_000_000,
>            data: forged_data,
>            owner: system_program::ID, // NOT the vault program
>            executable: false,
>            rent_epoch: 0,
>        },
>    )
>    .unwrap();
>
>    // Build `withdraw`, passing the forged config and the attacker as signer.
>    let ix = Instruction {
>        program_id: leaky_vault::ID,
>        accounts: vec![
>            AccountMeta::new_readonly(fake_config, false),
>            AccountMeta::new(attacker.pubkey(), true),
>        ],
>        data: leaky_vault::instruction::Withdraw { _amount: 0 }.data(),
>    };
>
>    let tx = Transaction::new_signed_with_payer(
>        &[ix],
>        Some(&attacker.pubkey()),
>        &[&attacker],
>        svm.latest_blockhash(),
>    );
>
>    // On the vulnerable build, this SUCCEEDS. That green result is the theft.
>    let result = svm.send_transaction(tx);
>    assert!(result.is_ok(), "exploit failed to reproduce");
>}

Run it once and confirm the attacker’s transaction succeeds. That passing assertion is the bug reproduced: a wallet that is not the admin just authorized a withdrawal.

4. Apply the fix and re-run the exact same attack. Change one thing in the program: stop trusting an unchecked account and let Anchor enforce ownership for you. Swap the config field to a typed account and read the field directly.

>#[derive(Accounts)]
>pub struct Withdraw<'info> {
>    // Account<T> checks the owner BEFORE deserializing. A System-owned
>    // forgery is rejected with AccountOwnedByWrongProgram.
>    pub config: Account<'info, Config>,
>    #[account(mut)]
>    pub signer: Signer<'info>,
>}

Both pieces must change together. The handler can no longer call try_borrow_data — that method lives on UncheckedAccount, and Account<'info, Config> has already deserialized the account for you — so read the field directly:

>pub fn withdraw(ctx: Context<Withdraw>, _amount: u64) -> Result<()> {
>    require_keys_eq!(
>        ctx.accounts.config.admin,
>        ctx.accounts.signer.key(),
>        VaultError::Unauthorized
>    );
>    msg!("withdraw authorized for {}", ctx.accounts.signer.key());
>    Ok(())
>}

Then flip your test’s assertion to expect failure (assert!(result.is_err(), "owner check should reject the forgery")), rebuild, and run the same attack. This time send_transaction returns an error before your authorization check ever runs, because Anchor’s Account<'info, T> verifies the account is owned by your program first — an owner-constraint violation, not your Unauthorized error. The attack is now stopped at the door, not at the lock inside.


### Run it
># Reproduce the exploit on the vulnerable build
>anchor build
>cargo test --package leaky_vault attack_drains_vault -- --nocapture
>
># Apply the Account<Config> fix in lib.rs, then prove the same attack now fails
>anchor build
>cargo test --package leaky_vault attack_drains_vault -- --nocapture

You reproduced a class of bug that has cost the Solana ecosystem hundreds of millions of dollars, and you did it with about thirty lines of attack code. The mechanism is now concrete rather than abstract: an account is just an address, some lamports, some bytes, and an owner field. If your program reads the bytes without reading the owner, an attacker supplies their own account whose bytes say whatever benefits them. Wormhole trusted a forged sysvar; Cashio trusted unvalidated collateral; your leaky_vault trusted a forged Config. Same shape, three times over.

The fix was almost anticlimactic, and that is the point worth sitting with. You did not write new validation logic in your handler. You changed UncheckedAccount to Account<'info, Config> and let the framework enforce the invariant that the manual code forgot. This is the throughline of the whole arc: most account-validation security is not clever code, it is declaring your assumptions in a place the runtime will enforce them. The attacker’s job is to find the one assumption you left undeclared. Today you got to be both people, and seeing the same transaction go from “succeeds” to “rejected” with a single type change is the kind of result that sticks.

One honest caveat: LiteSVM’s set_account gave you a shortcut to forge state instantly, which is exactly why it is such a good reproduction tool. On a live cluster an attacker cannot rewrite arbitrary accounts; they create their own and pass those in. The owner check defeats both, which is why it is the right fix regardless of how the forgery is produced.

