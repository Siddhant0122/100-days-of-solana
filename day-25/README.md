## Explore system program accounts
You have been working with Solana accounts for a few days now andYouhave a sense of how data lives on-chain. But there is a layer beneath everything you have touched so far: the System Program. Every wallet you have created, every SOL transfer you have made, every new account that has come into existence on Solana has gone through this single program. Today, you are going to pull back the curtain and look at the accounts the System Program manages, how they are structured, and what makes them different from other account types on the network.

Think of it this way: if Solana’s account model is a filing system, the System Program is the clerk who opens new folders, labels them, and decides who gets to write in them. Understanding this clerk’s job is essential before you start building programs of your own.

### Steps
#### Step 1: Set your CLI to devnet and check your wallet

Make sure your CLI is pointed at devnet and that you have a keypair ready.

> solana config set --url devnet
> solana address
> solana balance
If your balance is zero, airdrop some devnet SOL:

> solana airdrop 2
> Note: The devnet airdrop can sometimes fail due to rate limiting. If this happens use the web faucet instead.

#### Step 2: Inspect your own wallet account

Your wallet is a system account, meaning it is owned by the System Program. Let’s look at its raw structure.

> solana account $(solana address)
You should see output showing five key fields:

Lamports: your balance in the smallest unit of SOL (1 SOL = 1,000,000,000 lamports)
Data Length: for a basic wallet, this is 0 bytes because system accounts do not store custom data
Owner: 11111111111111111111111111111111, which is the System Program’s address
Executable: false, because your wallet is not a program
Rent Epoch: a legacy field (rent collection has been deprecated on Solana, so this is set to the maximum value for all rent-exempt accounts)
Take note of that Owner field. The string of all 1s is the public key of the System Program. Any account whose owner is 11111111111111111111111111111111 is a system account.

#### Step 3: Inspect the System Program itself

The System Program is also an account on Solana. Let’s look at it.

> solana account 11111111111111111111111111111111
Notice the differences from your wallet:

Executable is true, because this account contains program code
Owner is NativeLoader1111111111111111111111111111111, the loader responsible for Solana’s built-in native programs
This is a fundamental insight: programs on Solana are just accounts with their Executable flag set to true. The System Program is not magic; it is an account like any other, just one that happens to contain executable code and is owned by the Native Loader.

#### Step 4: Compare with other native programs

Solana has several native programs built into the runtime. Let’s inspect a couple more.

> solana account Stake11111111111111111111111111111111111111
> solana account Vote111111111111111111111111111111111111111
These are the Stake Program and the Vote Program. Notice they share the same pattern as the System Program: Executable is true, and they are all owned by the Native Loader. These programs handle validator staking and voting on the network.

#### Step 5: Explore a sysvar account

Sysvar accounts are special read-only accounts at predefined addresses that expose cluster-wide state, such as the current time or the rent cost. They are like environment variables for the entire Solana network.

> solana account SysvarC1ock11111111111111111111111111111111
> solana account SysvarRent111111111111111111111111111111111
Look at the output for each:

The Clock sysvar holds the current slot, epoch, and Unix timestamp
The Rent sysvar holds the lamports-per-byte-year rate (though rent collection itself is deprecated, the rent-exemption threshold is still calculated from this)
Both are owned by the Sysvar1111111111111111111111111111111111111 program, and both have Executable set to false because they hold data, not code. This is the opposite of what you saw with native programs.

#### Step 6: View accounts in the Solana Explorer

Open Solana Explorer (devnet) in your browser. Paste in each of the addresses you inspected:

Your wallet address
> 11111111111111111111111111111111 (System Program)
> SysvarC1ock11111111111111111111111111111111 (Clock sysvar)
The Explorer gives you the same information in a visual format, along with transaction history. Compare what you see on screen with the CLI output. Notice how the Explorer labels the account type (e.g., “System Program” or “Sysvar”) automatically.

#### Step 7: Pull it all together with JSON output

For a structured view, you can request JSON output from the CLI.

> solana account $(solana address) --output json
> solana account 11111111111111111111111111111111 --output json
JSON output is useful when you want to pipe account data into scripts or compare fields programmatically. Take a moment to compare the two JSON outputs side by side: your wallet vs. the System Program. The differences in executable, owner, and data tell you everything about what kind of account you are looking at.