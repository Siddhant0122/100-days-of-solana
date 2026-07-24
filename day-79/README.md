## Close every hole with one line of Anchor

Yesterday you put on the attacker’s hat and found the gaps: an account accepted without confirming who owns it, an authority field nobody checked against the signer, a PDA passed in raw and trusted. Today you close those gaps. The satisfying part is that almost none of this requires new logic inside your instruction handlers. Anchor lets you push validation up into the account struct itself, where a single line of attribute syntax encodes a rule the runtime enforces before your handler ever runs. You write the rule once, declaratively, and every call to that instruction is checked for free.

A penetration tester finds the hole; an engineer welds it shut so it never opens again. That second job is the one with leverage. A manual check buried in a handler can be forgotten, duplicated inconsistently, or quietly deleted in a refactor. A constraint declared on the account struct sits right next to the account it guards, reads like documentation, and fails loudly with a named error the moment an attacker sends something that violates it.

The thing worth internalizing today is that Anchor’s account types are themselves your first layer of validation. The moment you type Signer<'info> instead of AccountInfo<'info>, you have answered the signer question. The moment you type Account<'info, Vault>, Anchor checks that the account is owned by your program and that its first eight bytes match the Vault discriminator, answering the owner question. The explicit #[account(...)] constraints handle everything those types cannot infer: which authority this account belongs to, which PDA it must be, what custom condition must hold. By the end of today your most dangerous instruction will refuse every malformed input you can throw at it, and you will have done it in attribute lines rather than imperative require! blocks.

You confirmed yesterday that your own programs are already fully constrained, so there is nothing of yours left to fix. Today you practice the technique on a deliberately insecure Withdraw instruction instead: rewrite its accounts struct so that every account is fully constrained, moving checks out of the handler body and into declarative attributes, then prove it compiles cleanly.

### Step
#### Step 1: Name the footguns in a concrete instruction
Here is a deliberately under-constrained withdraw instruction. It is the kind of thing that compiles, passes a happy-path test, and quietly hands an attacker someone else’s funds. Read it with the two audit questions from yesterday in mind.

// INSECURE, do not ship this
>#[derive(Accounts)]
>pub struct Withdraw<'info> {
>    pub authority: Signer<'info>,
>
>    #[account(mut)]
>    pub vault: Account<'info, Vault>,
>
>    pub system_program: Program<'info, System>,
>}

The good news from yesterday’s audit: Signer<'info> already answers the signer question for authority, and Account<'info, Vault> already answers the owner question for vault, because that type makes Anchor verify the account is owned by your program and carries the right discriminator. The footgun that remains is the relationship between them. Nothing here checks that this particular vault belongs to this particular authority, and nothing checks that vault is the real program-derived address rather than some other Vault account an attacker initialized and funded as bait. An attacker signs as themselves, passes in the victim’s vault, and the handler happily drains it.

#### Step 2: Make the state account carry what the constraints need
For Anchor to check the vault-to-authority relationship, the Vault account has to store the authority it belongs to. And for the PDA check to use the canonical bump you saved at initialization (a pattern you met in an earlier arc), store the bump too.

>#[account]
>pub struct Vault {
>    pub authority: Pubkey,
>    pub bump: u8,
>}

Step 3: Add one constraint per question, on the account itself
Now rewrite the struct so each rule lives next to the account it governs. Three additions close every remaining gap.

// SECURE
>#[derive(Accounts)]
>pub struct Withdraw<'info> {
>    pub authority: Signer<'info>,
>
>    #[account(
>        mut,
>        seeds = [b"vault", authority.key().as_ref()],
>        bump = vault.bump,
>        has_one = authority,
>    )]
>    pub vault: Account<'info, Vault>,
>
>    pub system_program: Program<'info, System>,
>}

Each line carries its weight:
- seeds = [b"vault", authority.key().as_ref()] with bump = vault.bump tells Anchor to re-derive the PDA from the signer’s key and confirm the passed-in vault address matches exactly. An attacker can no longer substitute a different account, because only the vault derived from their own key will satisfy the derivation, and that vault is the one they are allowed to touch.
- has_one = authority checks that the authority field stored inside the Vault account equals the authority account in the struct. This binds the on-chain record to the live signer. If they ever diverge, the instruction fails before your handler runs.
- mut stays because the withdraw mutates the vault’s lamports, and Anchor will reject any attempt to mutate an account you did not mark mutable.

With those three lines in place, the imperative checks you may have written inside the handler (an if vault.authority != authority.key() guard, a manual Pubkey::find_program_address comparison) become redundant. Delete them. The struct is now the single, readable source of truth for what a valid Withdraw looks like.

#### Step 4: Reach for the right constraint for each remaining account
Different accounts need different guards. Keep this short catalog next to your audit notes and apply the matching constraint to every account in every instruction you harden. Each one supports a custom error with @ MyError::Variant so the failure reads clearly in your logs.

- Bind an account to a field on another account: #[account(has_one = mint)] checks this_account.mint == mint.key(). Use it for every “who does this belong to” relationship.
- Pin an account to one exact address: #[account(address = crate::ADMIN_PUBKEY)] rejects anything but that specific key. Use it for hardcoded admins or known program accounts.
- Validate a PDA: #[account(seeds = [...], bump = state.bump)] re-derives and confirms the address, as you did above.
- Validate a token account’s mint and owner: #[account(token::mint = mint, token::authority = authority)] confirms an SPL token account holds the expected mint and is controlled by the expected authority. This is the constraint that stops an attacker from passing a token account for the wrong mint, which is exactly the kind of substitution the Sealevel attacks catalog documents.
- Express any other rule: #[account(constraint = vault.balance >= amount @ VaultError::InsufficientFunds)] takes an arbitrary boolean expression. Reserve this for conditions the typed constraints cannot express.
- Last resort, an unchecked account: if you genuinely must accept a raw UncheckedAccount<'info>, Anchor forces you to write a /// CHECK: doc comment above it explaining why skipping validation is safe. Treat every /// CHECK: in your codebase as a flag for tomorrow’s adversarial tests.

#### Step 5: Confirm it still compiles
Constraints are generated into account-validation code at compile time, so a clean build confirms your attribute syntax is valid and your types line up. The constraints actually firing against malicious input is what you will prove with adversarial tests tomorrow; today’s win is a fully constrained struct that builds.

Run it
>anchor build

If the build fails, read the error: a missing field referenced by has_one, a bump that is not stored on the state account, or a seed that does not match your initialization code are the usual culprits, and each points straight at the line to fix.

You moved validation from something a developer has to remember to write into something the framework enforces structurally. That shift matters more than any single constraint. Yesterday’s audit found gaps by thinking like an attacker; today you closed them in a place where they cannot silently reopen, because the rule now lives on the account struct that every caller has to pass through. The next person who reads this instruction, including future you, sees the full security contract in a dozen lines of attributes rather than having to trace handler logic to reconstruct it.

There is a deeper idea here worth carrying forward. In a Web2 API you often validate at the edge, in middleware, and trust the request once it is past the gate. A Solana program has no trusted edge: every account in every instruction is attacker-controlled until you prove otherwise. Anchor’s constraints are how you prove it, declaratively, for every account, on every call. You have just converted a class of “the developer forgot to forbid it” bugs into “the runtime forbids it by construction.” That is the most durable kind of fix, and it is the foundation the rest of this arc builds on.

