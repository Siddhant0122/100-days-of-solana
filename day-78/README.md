## Audit your own code like an attacker

Arc theme: Advanced Testing and Security

Web2 bridge: Security auditing Solana programs is like penetration testing a production API: you think like an attacker to protect your users

The most expensive bugs in Solana’s history are rarely exotic. The Wormhole bridge lost roughly $326 million because one account was accepted without confirming what it really was, and a long list of smaller incidents trace back to the same root: a program trusted an account it never actually checked. Account-validation failures, not clever cryptography breaks, are the number one cause of on-chain losses. The reassuring part is that these are also the most findable class of bug, because the question you ask is always the same.

For the last few arcs you have been writing programs and reading their errors as a builder: what did I mean for this to do, and why did the runtime stop me? Today you swap hats. A penetration tester does not ask “what did the developer intend”; they ask “what did the developer forget to forbid.” That single shift in posture is the whole job. You are going to point it at your own earlier work, before anyone else gets the chance to.

There are exactly two questions in today’s audit, and you will ask both of them about every account in every instruction. The first is the owner question: if this account’s data matters to my logic, does the program guarantee which program owns it? The second is the signer question: if this account authorizes the action, does the program require it to actually sign the transaction? Anchor answers both for you when you use the right account type, and silently answers neither when a program reaches for an escape hatch like UncheckedAccount. Your job is to check every account against both questions and decide, for each one, whether the program was allowed to trust it.

### Steps
If you built the counter well, every account already answers both questions with a “yes,” so expect a clean sweep. That is not a wasted audit: confirming each account passes, and naming the guard that earns the “yes” (a Signer type, an Account< T > owner check, a has_one constraint), is exactly the clean bill of health a real auditor delivers most days. The UpdateProfile struct in step 4 is your specimen of the opposite, an account that fails the signer question, so you still see and flag one without touching your own code.

1. List every account. Open your program and find each struct that derives #[derive(Accounts)]. Inside each one, write down every field. A typical update or close instruction has three or four: the state account, an authority, maybe a system program or token program. You are building an inventory, and you cannot audit what you have not listed.

2. Classify each field by its type. The type is the security control. Mark each account as one of:
    - Signer<'info> confirms the account signed the transaction. It performs no ownership or data checks, which is fine because a signer is proving identity, not lending you data. See the Signer reference.
    - Account<'info, T> deserializes the data and verifies the account is owned by the program that defines T (your program for your own state, the token program for token accounts). This is your owner check, applied automatically. See the Account reference.
    - Program<'info, T> verifies the account is the specific executable program you expect.
    - UncheckedAccount<'info> or AccountInfo<'info> checks nothing. No owner check, no signer check, no type check. Every account marked this way is a place where you personally promised to do the validation by hand, or chose to skip it.

3. Ask the owner question of every account whose data you read. If you read a field off an account, mutate it, or trust a balance, the account must carry an owner guarantee. Account<'info, T> gives you one for free. If that same data is sitting behind an UncheckedAccount and you deserialize it manually, write down a finding: an attacker can hand you a look-alike account owned by a program they control, shaped to pass whatever loose check you wrote.

4. Ask the signer question of every account that authorizes something. Find every account named authority, owner, admin, creator, or anything that decides “is this caller allowed.” If its type is not Signer, write down a finding, even when its public key is compared against stored state. Comparing a public key only proves someone knew a public key, and public keys are public. It does not prove the holder of the matching private key approved this transaction.

>#[derive(Accounts)]
>pub struct UpdateProfile<'info> {
>    #[account(mut, has_one = authority)]
>    pub profile: Account<'info, Profile>,
>
>    /// CHECK: compared to profile.authority via has_one
>    pub authority: UncheckedAccount<'info>,
>}

5. Write up your findings, but do not fix yet. Today is reconnaissance. For each instruction, record a short note: the account, its current type, which question it fails, and the one-sentence consequence if an attacker exploited it. A finding like “UpdateProfile.authority is UncheckedAccount, fails the signer question, lets anyone edit any profile” is exactly the artifact a real auditor produces. Keeping diagnosis and repair on separate days is deliberate: it stops you from “fixing” a line before you have understood why it was dangerous.

### Run it

Before you trust your manual sweep, let the terminal confirm it. From your program’s root, surface any unchecked accounts and the /// CHECK comments Anchor requires above them:

>grep -rn "UncheckedAccount\|AccountInfo\|/// CHECK" programs/*/src

On a well-built program like the counter this comes back empty, and that emptiness is the result you want: the terminal agreeing you left no escape hatches. If it does print a line, that account is one where Anchor stepped back and handed the developer the responsibility, so cross-reference it against your inventory, and if it authorizes an action or feeds you data you trust, it belongs in your findings.

You ran the same first pass a professional auditor runs, and you ran it with two questions instead of a vague sense of unease. That precision is the point. “Is this program secure” has no answer, but “does every authority account sign, and does every data account carry an owner guarantee” has a yes or no for each line, and a stack of yes-or-no answers is a real audit.

The deeper lesson is what Anchor was doing for you the whole time. When you wrote Account<'info, T> and Signer<'info> back in Arc 9 without thinking much about it, the framework was inserting owner and signer checks on your behalf. The danger is never the typed accounts; it is the moments a program opts out with UncheckedAccount to make something compile, and then forgets it has taken on a promise. Today you learned to find those promises, and confirmed your counter never left one unkept. Tomorrow you practice closing that gap on an instruction that does carry it, while the typed accounts that already do their job correctly stay exactly as they are.
