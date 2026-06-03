## Build a Multi-Extension Token

In Web2, when you build a payment feature for an application, you rarely add just one capability. A subscription service charges a processing fee on every transaction, displays accrued credits over time, and stores product metadata so the frontend can render a name and icon. Each of those features comes from a different library or API, and wiring them together is your job.

Solana’s Token Extensions Program lets you compose these capabilities at the protocol level. I have already used transfer fees, interest-bearing rates, and metadata as individual extensions across previous days. Today, I am going to combine all three into a single token mint. One command creates the account with space for every extension, and each feature works independently without conflicting with the others.

This is the real payoff of the extension model: instead of bolting features on after the fact (which Solana does not allow), you declare everything up front and the runtime enforces it all. By the end of today, you will have a single token that charges fees on transfers, displays an interest-adjusted balance, and carries its own name and symbol on-chain.

### Steps
#### Step 1: Create the multi-extension mint

You are going to create a single token mint with three extensions enabled at once: transfer fees, an interest-bearing rate, and a metadata pointer. The CLI calculates the total account size needed for all the extension data and allocates it in one transaction.

Run this command to create the mint:

Run It
>spl-token --program-id TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb \
>  create-token \
>  --decimals 2 \
>  --transfer-fee-basis-points 100 \
>  --transfer-fee-maximum-fee 500 \
>  --interest-rate 5 \
>  --enable-metadata

This single command does several things at once:

- --decimals 2 sets the token to two decimal places, like dollars and cents
- --transfer-fee-basis-points 100 configures a 1% fee on every transfer (100 basis points = 1%)
- --transfer-fee-maximum-fee 500 caps the fee at 5 tokens (500 in raw units with 2 decimals)
- --interest-rate 5 attaches a 5% continuous compounding interest rate
- --enable-metadata reserves space for on-chain metadata

Copy the mint address from the output. You will use it in every step that follows.

#### Step 2: Add metadata to the mint

The --enable-metadata flag reserved space for metadata, but it did not fill it in. Now you will initialize the token’s name, symbol, and metadata URI. Replace [MINT_ADDRESS] with the address you copied in Step 1.

Run It
>spl-token initialize-metadata \
>  [MINT_ADDRESS] \
>  "ArcCoin" \
>  "ARC" \
>  "https://raw.githubusercontent.com/solana-developers/opos-asset/main/assets/CompressedCoil/metadata.json"

That URI points to a sample metadata JSON file hosted on GitHub. In a production token, you would host your own JSON file with a name, symbol, description, and image URL. For today, the sample file works perfectly.

#### Step 3: Inspect the mint

Before minting any tokens, verify that all three extensions are active on the mint account.

Run It
> spl-token display [MINT_ADDRESS]

Look through the output carefully. You should see sections for each extension:

A Transfer fee section showing the basis points and maximum fee
An Interest-bearing section showing the rate
A Metadata pointer and Metadata section showing the name, symbol, and URI
All three are stored in the same mint account. The Token Extensions Program allocated enough space for every TLV (type-length-value) entry when you created the mint.

#### Step 4: Create a token account and mint tokens

Create a token account for your wallet, then mint 1,000 tokens to it.

Run It
> spl-token create-account [MINT_ADDRESS]

> spl-token mint [MINT_ADDRESS] 1000

#### Step 5: Create a second wallet and transfer tokens

To see the transfer fee in action, you need a second wallet. Generate a new keypair, create a token account for it, and send some tokens.

Run It
> solana-keygen new --outfile ~/second-wallet.json --no-bip39-passphrase --force

> spl-token create-account [MINT_ADDRESS] --owner ~/second-wallet.json --fee-payer ~/.config/solana/id.json

> spl-token transfer [MINT_ADDRESS] 100 ~/second-wallet.json --expected-fee 1 --allow-unfunded-recipient

The --expected-fee flag tells the CLI you expect a 1% fee on the transfer. Out of the 100 tokens sent, 1 token is withheld as a fee and deposited into the recipient’s token account in a special withheld balance. The recipient receives 99 tokens in their available balance.

### Step 6: Check the balances

Verify the transfer worked and the fee was collected.

Run It
>spl-token balance [MINT_ADDRESS]

>spl-token balance [MINT_ADDRESS] --owner ~/second-wallet.json

Your original wallet should show 900 tokens. The second wallet should show 99 tokens (100 minus the 1-token fee).

#### Step 7: Observe the interest-adjusted display amount

The interest-bearing extension does not change the raw balance on-chain. Instead, it provides a formula that wallets and applications use to display an adjusted amount based on elapsed time. Check the UI amount for your token account:

Run It

>spl-token display [MINT_ADDRESS]

The interest rate is applied using continuous compounding. Because only seconds or minutes have passed since you minted the tokens, the UI amount adjustment will be very small. Over longer periods, the difference between the raw amount and the displayed amount grows. The key insight is that the interest calculation and the transfer fee operate completely independently: one adjusts how amounts are displayed, and the other deducts tokens during transfers.

Step 8: Harvest the withheld fees

Transfer fees accumulate in a withheld balance on recipient token accounts. As the mint authority, you can harvest those fees. First, find the second wallet’s token account address, then withdraw the withheld fees.

Run It
spl-token accounts --owner ~/second-wallet.json -v
spl-token withdraw-withheld-tokens [YOUR_TOKEN_ACCOUNT] [SECOND_WALLET_TOKEN_ACCOUNT]
Replace [YOUR_TOKEN_ACCOUNT] with your own token account address and [SECOND_WALLET_TOKEN_ACCOUNT] with the token account address from the previous command’s output. The withheld fee is transferred to your token account.