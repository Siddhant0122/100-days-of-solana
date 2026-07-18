## Close a PDA account and reclaim rent
Your wallet is a little lighter than it was a week ago. Every counter PDA from Days 65 and 66 is holding a small balance of SOL hostage, and the runtime will keep holding it until you ship the instruction that gives it back.

The first time you ran init_counter, the program quietly pulled a fraction of a SOL out of your wallet and parked it inside the new PDA. Solana calls that a rent-exempt deposit. It is the price of telling the runtime that the account is allowed to exist indefinitely without paying ongoing rent. One counter is barely noticeable. Initialize ten of them while debugging the work from Days 65 and 66 and the wallet starts to feel lighter.

Your Web2 instinct here is close to correct. This is the storage-deposit pattern: pay a refundable amount when you create a row, get it back when you delete it. Postgres does not do this because disk is cheap and shared. Solana does, because the validators replicating your account data are spread across thousands of machines and somebody has to be compensated for the bytes you are taking up. The good news is that the network never keeps the deposit. The moment the account stops existing, the lamports move back to whoever you point them at.

What you do not get to do is reach into the runtime yourself and free the bytes. You add one Anchor constraint, write a four-line handler, and let the framework drain the account in its teardown phase. By the end of today you will have an instruction that takes a counter PDA, sends every lamport inside it back to the wallet that owns it, and zeroes the account so nothing else can be done with it.

### Steps
1. Open programs/counter/src/lib.rs and add a new instruction handler beneath increment. The body has nothing to do, because Anchor will do all the real work in the accounts struct.
>pub fn close_counter(_ctx: Context<CloseCounter>) -> Result<()> {
>    Ok(())
>}

2. At the bottom of the file, next to your other #[derive(Accounts)] structs, add the accounts struct for the new instruction. The close = user attribute is the entire feature you are shipping today.
>#[derive(Accounts)]
>pub struct CloseCounter<'info> {
>    #[account(
>        mut,
>        close = user,
>        seeds = [b"counter", user.key().as_ref()],
>        bump = counter.bump,
>        has_one = user,
>    )]
>    pub counter: Account<'info, Counter>,
>    #[account(mut)]
>    pub user: Signer<'info>,
>}

Read that struct carefully. close = user tells Anchor to drain the counter’s lamports into the user account and mark the data as closed when the instruction returns. has_one = user is the wall that stops a stranger from closing a counter that does not belong to them, because Anchor will check that the user field stored on the counter matches the signer you passed in. The PDA derivation still uses the same seeds and the stored bump, so the address you are operating on is exactly the one you created two days ago.

3. Open tests/counter.ts, the file you rewrote on Day 66. Add this new test inside the existing describe block, below the other tests. The shape is: initialize a counter, capture the wallet balance and the account’s lamports, call closeCounter, then assert the account is gone and the rent came back.
>it("closes a counter and refunds the rent", async () => {
>  const user = provider.wallet.publicKey;
>  const [counterPda] = anchor.web3.PublicKey.findProgramAddressSync(
>    [Buffer.from("counter"), user.toBuffer()],
>    program.programId,
>  );
>
>  // Initialize a fresh counter if the previous test already closed it.
>  const existing = await provider.connection.getAccountInfo(counterPda);
>  if (existing === null) {
>    await program.methods.initCounter().rpc();
>  }
>
>  const counterAccount = await provider.connection.getAccountInfo(counterPda);
>  const rentLamports = counterAccount!.lamports;
>  const balanceBefore = await provider.connection.getBalance(user);
>
>  await program.methods.closeCounter().rpc();
>
>  const counterAfter = await provider.connection.getAccountInfo(counterPda);
>  const balanceAfter = await provider.connection.getBalance(user);
>
>  if (counterAfter !== null) {
>    throw new Error("counter account still exists after close");
>  }
>
>  console.log("rent refunded (lamports):", rentLamports);
>  console.log("net wallet change (lamports):", balanceAfter - balanceBefore);
>});

The first getAccountInfo call tells you how much SOL the account is holding. The second one, after the close, should return null, because the lamport balance hit zero and the runtime swept the account out of existence at the end of the transaction.

4. Build the program so your IDL and TypeScript types pick up the new instruction.
>anchor build

5. Run the tests. Anchor will spin up a local validator, deploy the updated program, and walk through the existing tests plus your new one. Watch the console for the two lines you printed.
Run it
>anchor test --validator legacy