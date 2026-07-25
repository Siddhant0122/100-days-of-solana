## Let a machine find the bug you'd never guess

You have written a handful of tests by hand. Each one picks a specific input, runs your program, and checks a specific result: deposit 100 lamports, expect a balance of 100. That style is honest and readable, but it only ever asks about the inputs you thought of. The bug that drains a program is almost always the input nobody thought of: the deposit that lands one lamport below u64::MAX, the withdrawal of exactly zero, the amount that wraps a counter back around to the start.

Today you stop guessing inputs one at a time. You will hand that job to two tools that generate inputs by the thousand and hunt for the one that breaks an invariant. This is a reinforce day: you are not learning a new program, you are pointing a much wider net at the program you already audited, constrained, and stress-tested over the last three days.

Think of a security reviewer who has finished reading your code and now wants to know what happens at the edges. They do not type a hundred examples by hand. They write down a rule that must always hold, then let a machine throw values at the rule until it either gives up or finds a counterexample. “A deposit can never make a balance smaller.” “Closing an account must return exactly the rent it held.” “Two harvests in a row must equal one harvest of the combined amount.”

These rules are called properties, and the technique is property-based testing. Its louder cousin is fuzzing: instead of testing a single function, a fuzzer drives your whole program through long, randomized sequences of instructions, mutating the inputs that reach new code paths and watching for any transaction that panics, overflows, or violates an invariant you declared. On a public chain there is no friendly QA team, so the first machine to find the edge case should be yours.

You will do this in two layers. First, a fast property test in pure Rust over a single arithmetic function, using proptest. Then you will wire up Trident, the Anchor-aware fuzzer from Ackee Blockchain, to fuzz your actual program end to end.

### Steps

1. Extract the arithmetic you want to prove correct. Property tests are easiest when the logic under test is a plain function with no accounts attached. Pull the math out of your instruction handler into a small, pure function so both your handler and your test can call it. For a deposit, that might be a single checked add:

>// programs/your_program/src/math.rs
>// Returns the new balance, or None if the deposit would overflow u64.
>pub fn apply_deposit(balance: u64, amount: u64) -> Option<u64> {
>    balance.checked_add(amount)
>}

Using checked_add instead of + is the arithmetic-safety habit from earlier this arc: on a release build a raw + can wrap silently, while checked_add hands you a None you must deal with. The property test is how you prove you actually handle it.

Two wiring steps make this real, and both are easy to miss. First, a src/math.rs file is not compiled until you declare it, so add mod math; to the top of lib.rs (right under declare_id!). Without that line the file is an orphan and your test silently never runs. Second, a handler has to actually call apply_deposit, both so it is not dead code and so the fuzzer has an instruction to drive. The withdraw-only vault from Day 80 has no deposit, so add one:

>// in #[program] mod vault
>pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
>    let vault = &mut ctx.accounts.vault;
>    vault.authority = ctx.accounts.authority.key();
>    vault.balance = math::apply_deposit(vault.balance, amount).ok_or(VaultError::Overflow)?;
>    Ok(())
>}
>
>#[derive(Accounts)]
>pub struct Deposit<'info> {
>    #[account(
>        init_if_needed,
>        payer = authority,
>        space = 8 + 32 + 8,
>        seeds = [b"vault", authority.key().as_ref()],
>        bump,
>    )]
>    pub vault: Account<'info, Vault>,
>    #[account(mut)]
>    pub authority: Signer<'info>,
>    pub system_program: Program<'info, System>,
>}

init_if_needed lets the fuzzer create a vault and then grow it from empty state, which is what makes this instruction fuzzable at all. It needs a feature flag in the program’s Cargo.toml (anchor-lang = { version = "...", features = ["init-if-needed"] }). The handler also references a new Overflow error, so add that variant to your enum:

>#[error_code]
>pub enum VaultError {
>    #[msg("Withdrawal exceeds vault balance")]
>    InsufficientFunds,
>    #[msg("Deposit overflows vault balance")]
>    Overflow,
>}

2. Add proptest as a dev-dependency. In your program’s Cargo.toml, add the test-only crate. The current release is 1.11.0; pinning to "1" keeps you on the latest compatible 1.x:

>[dev-dependencies]
>proptest = "1"

3. Write the property, not the example. A property describes what must be true for every input. The proptest! macro generates inputs for you, and when it finds a failure it automatically shrinks that input down to the smallest value that still fails, so you get a clean counterexample instead of a giant random number. Add this test module at the bottom of the same math.rs file — use super::apply_deposit pulls in the function defined just above it:

>#[cfg(test)]
>mod tests {
>    use super::apply_deposit;
>    use proptest::prelude::*;
>
>    proptest! {
>        // proptest runs this hundreds of times with generated u64 pairs.
>        #[test]
>        fn deposit_never_shrinks_a_balance(balance in any::<u64>(), amount in any::<u64>()) {
>            match apply_deposit(balance, amount) {
>                // If it succeeded, the new balance must be at least the old one.
>                Some(new_balance) => prop_assert!(new_balance >= balance),
>                // If it returned None, the real sum must genuinely overflow.
>                None => prop_assert!(balance.checked_add(amount).is_none()),
>            }
>        }
>    }
>}

Read the property out loud: a deposit either grows the balance or refuses honestly. There is no third option where it silently wraps to a tiny number. That single test covers a space no hand-written example list could.

4. Install Trident for full-program fuzzing. proptest is perfect for pure functions, but your real risk lives in sequences of instructions against live account state. That is Trident’s job. It works with your Anchor 1.0 program because it loads your compiled .so and runs it in its own in-process VM, generating the input types it needs from your IDL, so it does not care which Anchor version built the program. Install the CLI (the current stable is the 0.12.x line; check crates.io for the exact latest):

>cargo install trident-cli

5. Generate the fuzz scaffold. From the root of your Anchor workspace, let Trident read your program and write a starter fuzz test for you. This creates a trident-tests/ directory and a Trident.toml config:

>trident init

6. Teach the fuzzer your invariant. trident init writes the scaffold but leaves the flows empty: #[init] and #[flow] arrive as blank stubs, and until you fill them Trident invokes nothing and prints an empty instruction table. This is Trident’s manually-guided fuzzing design, not a bug: you write the flow that builds an instruction from the generated types, sends it, and asserts your invariant before and after. Open trident-tests/fuzz_0/test_fuzz.rs and replace the stub flow with:

>#[flow]
>fn deposit_never_shrinks(&mut self) {
>    let authority = self.fuzz_accounts.authority.insert(&mut self.trident, None);
>    self.trident.airdrop(&authority, 10_000_000_000);
>
>    let (vault_pda, _) =
>        Pubkey::find_program_address(&[b"vault", authority.as_ref()], &vault::program_id());
>
>    let before = self.trident
>        .get_account_with_type::<Vault>(&vault_pda, 8)
>        .map(|v| v.balance)
>        .unwrap_or(0);
>
>    let amount = self.trident.random_from_range(0..1_000_000u64);
>
>    let ix = vault::DepositInstruction::data(vault::DepositInstructionData::new(amount))
>        .accounts(vault::DepositInstructionAccounts::new(vault_pda, authority))
>        .instruction();
>    self.trident.process_transaction(&[ix], Some("Deposit"));
>
>    if let Some(v) = self.trident.get_account_with_type::<Vault>(&vault_pda, 8) {
>        assert!(v.balance >= before, "deposit shrank the balance");
>    }
>}

Match DepositInstructionAccounts::new(...) to the signature in your generated types.rs; Trident fills system_program itself, so it is usually just (vault, authority). The same shape works for other invariants: an authority that must never change, a total that must equal the sum of deposits.

### Run it
Run the fast property test first, then turn the fuzzer loose on the whole program:

># Property test: hundreds of generated u64 pairs against apply_deposit
>cargo test deposit_never_shrinks_a_balance
>
># Full-program fuzzing: run this from inside the trident-tests directory
># that `trident init` created, because that is where Trident.toml lives and
># the CLI searches upward from your current directory to find it. Replace the
># name with your generated fuzz test (the scaffold names the first one fuzz_0).
>cd trident-tests
>trident fuzz run fuzz_0

Read the Trident summary table, not just the “completed” line: your instruction must show a non-zero Invoked Total. An empty table means your flow is still a stub and nothing was fuzzed — a green run that tested zero transactions. A real run shows, for example, Deposit | 100000 invoked | 100000 success | 0 panicked with your invariant holding on every one.

If a property holds, proptest prints a normal green pass and you have proven something about every input it tried. If Trident finds a transaction that violates an invariant or panics, it stops and hands you the exact instruction sequence and inputs that did it, ready to drop straight into a regression test.

Up to now your test suite has worked from a list of examples you authored. That list is only as imaginative as the day you wrote it. By stating properties and invariants instead, you flipped the work: you described the rule that must hold and let proptest and Trident manufacture the inputs, including the awkward ones at the very top and bottom of the u64 range where overflow bugs live. The biggest Solana losses, Wormhole and Cashio, were account-validation failures rather than overflow bugs, so do not expect a famous arithmetic heist here. But the arithmetic edges are real and well documented: Neodyme’s 2021 disclosure of a rounding bug in the SPL token-lending program put roughly $2.6 billion of deposited value at risk, because a withdrawal that rounded up by a hair instead of down could be repeated for profit, and Certora’s audit of Kamino Lending later caught a fixed-point precision bug that could have let a user redeem more collateral than they deposited. Both were found and fixed with checked math and round-down logic before anyone lost money, which is exactly what a fuzzer is built to do: surface the unloved edge before an attacker does.

This is why today reinforces rather than introduces. The adversarial LiteSVM tests you wrote earlier this week each pinned down one attack you imagined. A property test pins down a whole class of attacks in one assertion, and a fuzz run explores combinations you would never script by hand. When a counterexample does appear, the right move is the same discipline from the rest of the arc: copy that exact input into a named, permanent test so the bug can never quietly return. Your suite stops being a list of things you happened to check and becomes a set of promises about how your program behaves under every input.

