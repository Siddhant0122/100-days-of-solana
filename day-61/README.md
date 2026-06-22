## Break your program on purpose and watch the tests catch it

There is exactly one way to know whether a test will catch a real bug: introduce the bug yourself and watch the test catch it. Everything else is faith.

This is an Experiment day. You are going to plant three bugs into your counter program, one at a time, run the suite, read the failure, then put each line back exactly the way it was. By the end you will have proof that every assertion in your suite is load-bearing: each one is the only thing standing between a real regression and a green check.

At your old job a senior engineer had a saying: “an untested line of code is a guess.” She had a follow-up that mattered more: “an untested assertion is also a guess.” If you remove an assertion and the suite stays green, you never needed it. If you remove a piece of production code and no test fails, you have a coverage gap and you do not know about it yet. The only way to tell which is which is to break things on purpose in a controlled environment, watch what happens, and put them back.

Web2 teams call this mutation testing when a tool does it for them. You are doing it by hand today, three times, because the muscle memory matters more than the tool. By the time you finish, you will trust your suite the same way you trust a brake pedal: not because the dashboard says it is fine, but because you have stepped on it.

### Steps
Before you change anything, confirm the baseline is healthy:

>git status
>anchor build && cargo test -p counter

If anything is red right now, fix it before you start. The point of today is to introduce a known bug into a known-good baseline. You cannot do that on top of an unknown failure.

#### Experiment 1: weaken the authority check
Open programs/counter/src/lib.rs and find your Increment accounts struct. It looks something like this:

>#[derive(Accounts)]
>pub struct Increment<'info> {
>    #[account(mut, has_one = authority)]
>    pub counter: Account<'info, Counter>,
>    pub authority: Signer<'info>,
>}

Delete the has_one = authority portion of that constraint, so only #[account(mut)] remains. Save and re-run the suite:

>anchor build && cargo test -p counter

One specific test should fail: the “rejects wrong signer” test you wrote yesterday. Read the failure message carefully. The test asserted that an unauthorized call would be rejected. With the constraint gone, the program now happily accepts that call, and the assertion no longer holds.

This is the most important moment of the day. Your negative test just caught a real regression. Without it, you would silently ship a program that lets anyone increment anyone else’s counter. Put the constraint back exactly as it was, save, re-run, and confirm green.

#### Experiment 2: break the arithmetic
Find the body of your increment handler. It contains something like:

>counter.count = counter.count
>    .checked_add(1)
>    .ok_or(ProgramError::ArithmeticOverflow)?;

Change checked_add(1) to checked_add(2). Save and re-run the suite.

(Why add 2 instead of switching to checked_sub? Because a fresh counter sits at zero, so subtracting would underflow and fail the whole transaction with an ArithmeticOverflow error before any assertion runs. Adding 2 lets the transaction succeed while storing a wrong number, which is exactly the kind of silent bug only an assertion can catch.)

Your happy-path increment test should fail at the assertion that compares the post-call count to its expected value. The failure prints the expected and actual numbers side by side: the counter holds 2, the test expected 1. Notice how a one-character change in production code produced a clear, specific failure with a clear, specific line number. That is what an assertion is for.

Restore checked_add(2) back to checked_add(1), save, re-run, and confirm green.

#### Experiment 3: break initialization
In your initialize handler, find the line that sets the authority field on the freshly created counter. It looks like this:

>counter.authority = ctx.accounts.authority.key();

Comment that line out. Save and re-run the suite.

This one is sneaky. The initialize transaction itself still succeeds: the account gets created, the rent gets paid, the count is zero. The bug only surfaces when the happy-path test calls increment with the correct wallet, because the on-chain authority field was left as the default Pubkey (all zeros) and your real wallet does not match it. The test panics on the send_transaction for increment, and the program logs spell out exactly what went wrong:

Error Code: ConstraintHasOne. Error Number: 2001.
Error Message: A has one constraint was violated.
Left:
11111111111111111111111111111111
Right:
<your authority pubkey>

Left is the authority stored on the counter account, all zeros because nobody set it. Right is the wallet that signed. Your two failure tests stay green the whole time, by the way: they only check that a bad call gets rejected, and a mismatch is still a mismatch.

Notice where the error points. The Anchor runtime reports the has_one violation at the increment step, not at the initialize step where the bug actually lives. That gap between “where it failed” and “where it broke” is a useful lesson on its own: your tests caught the bug, but the failure points downstream of the cause. Uncomment the line, save, re-run, and confirm green.

