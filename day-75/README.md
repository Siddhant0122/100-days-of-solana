## Read a CPI failure like a sentence

Programs fail in specific, repeatable ways. Once you have seen the same error message three times, the fourth time stops feeling like a wall and starts feeling like a clue. Today you go looking for those clues on purpose, by breaking the working program-to-program cross-program invocation from earlier this week in three deliberate ways and reading what the runtime says back.

For three days you have been the one calling other programs and watching them obey. The System Program moved lamports when you asked. The Token-2022 program minted tokens when you asked. Yesterday your own program called your own program and the runtime did not blink. Every one of those calls worked because every account, every signer, and every seed lined up exactly with what the callee expected.

Production is the place where they will not line up. A user passes the wrong token account. A PDA derivation drifts by one byte because of a refactor. An account that should be writable is not. When that happens, the only thing standing between you and a fix is your ability to read the program logs and know what they mean. So today you will produce those failures yourself, three of them, each one telling a different story.

### Failure's transcript 
#### Failure 1 — wrong signer seeds:

When I see this line in the logs — "<pubkey>'s signer privilege escalated" followed by Cross-program invocation with unauthorized signer or writable account — the cause is: the program tried to sign a CPI with invoke_signed using seeds that don't re-derive to the account it's claiming authority over, so the runtime refuses to grant that account signer status.

#### Failure 2 — missing/wrong account (seeds constraint):

When I see this line in the logs — AnchorError caused by account: tally. Error Code: ConstraintSeeds. Error Number: 2006 with a Left: / Right: pubkey pair — the cause is: Anchor re-derived the expected PDA from the seeds constraint and it doesn't match the pubkey the client actually passed in for that account, so it rejects the account before the instruction logic ever runs.

#### Failure 3 — wrong program ID:

When I see this line in the logs — Program 11111111111111111111111111111111 invoke [2] immediately followed by failed: invalid instruction data — the cause is: the CPI was routed to a real, live program (the System Program) that has no idea what to do with the Anchor-encoded instruction data it was handed, so it fails trying to parse data meant for a completely different program.