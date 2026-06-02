## Review token incentive mechanics

Over the past three days, I have built up a toolkit for working with tokens on Solana. I created a basic mint on devnet, added metadata so my token has a real identity, and then stretched into the Token Extensions Program to attach transfer fees at the protocol level. Each day introduced something new, and each step built on the one before it.

But here is the thing about learning new systems: individual steps make sense in the moment, then blur together a day later. If someone asked me right now to spin up a fully branded token with transfer fees from a blank terminal, could I do it without checking my notes? Today is about finding out. I am going to walk through the entire token lifecycle in one sitting, from key pair to fee collection, reinforcing every concept I have touched this week.

Think of it like onboarding at a new company. The first few days, someone walks I through each system one at a time. Then there is a day where they say, “OK, now do it all yourself.” That is today.

### Steps
#### Step 1: Confirm your environment

Before you start building, verify that your CLI is pointed at devnet and your wallet has funds. This is the equivalent of checking that your local dev server is running before you start writing code.

Run It
> solana config set --url devnet

> solana balance

If your balance is below 2 SOL, request an airdrop:

> solana airdrop 2

> Note: The devnet airdrop can sometimes fail due to rate limiting. If this happens use the web faucet instead.

#### Step 2: Create a token with transfer fees in a single command

On Day 29, you created a plain token. On Day 31, you created one with a transfer fee extension. Today, combine what you know. Create a new token using the Token Extensions Program (Token-2022) with a transfer fee baked in from the start. Set the fee to 200 basis points (2%) with a maximum fee of 5000 tokens (in the smallest unit).

Run It
>spl-token create-token --program-id TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb --transfer-fee-basis-points 200 --transfer-fee-maximum-fee 5000 --enable-metadata --decimals 9

Write down the mint address that gets printed. You will use it in every step that follows.

#### Step 3: Add metadata to your token

On Day 30, you learned that a token without metadata is just an address. Give your token an identity by initializing its metadata extension with a name, symbol, and URI. This must happen before you mint any supply, because initialize-metadata requires zero supply on the mint.

Run It
>spl-token initialize-metadata [YOUR_MINT_ADDRESS] "ReinforceCoin" "RFC" "https://raw.githubusercontent.com/solana-developers/opos-asset/main/assets/CompressedCoil/metadata.json"

Then confirm it took effect:

spl-token display [YOUR_MINT_ADDRESS]
You should see your token’s name, symbol, and URI in the output alongside the transfer fee configuration. Two extensions, one mint.

#### Step 4: Create a token account and mint supply

A mint on its own holds no tokens. You need a token account to hold your supply. Create one, then mint 1,000 tokens to it.

Run It
>spl-token create-account [YOUR_MINT_ADDRESS]

>spl-token mint [YOUR_MINT_ADDRESS] 1000

Verify your balance:

>spl-token balance [YOUR_MINT_ADDRESS]

You should see 1000. This is the same flow you did on Day 29, but now with the Token-2022 program running behind it.

#### Step 5: Create a token account for your second wallet.

You need a destination for the transfer. Create a token account owned by your second keypair:

>spl-token create-account [YOUR_MINT_ADDRESS] --owner [RECIPIENT_WALLET_ADDRESS] --fee-payer ~/.config/solana/id.json

#### Step 6: Transfer tokens and observe the fee

Now test the transfer fee in action. Send 100 tokens to your second wallet. Because you configured a 2% fee, the recipient should receive 98 tokens, and 2 tokens should be withheld in their token account.

Run It

>spl-token transfer --fund-recipient [YOUR_MINT_ADDRESS] 100 [RECIPIENT_WALLET_ADDRESS] --expected-fee 2 --allow-unfunded-recipient

Check what the recipient actually received:

>spl-token balance --owner [RECIPIENT_WALLET_ADDRESS] [YOUR_MINT_ADDRESS]

The balance should read 98. The remaining 2 tokens are withheld in the recipient’s token account, untouchable by the recipient, waiting for the withdraw authority (you) to collect them.

#### Step 7: Collect your withheld fees

Fees sitting in individual token accounts are not useful until you collect them. Use the withdraw-withheld-tokens command to pull the withheld fees from the recipient’s account into your own.

Run It
>spl-token withdraw-withheld-tokens [YOUR_TOKEN_ACCOUNT_ADDRESS] [RECIPIENT_TOKEN_ACCOUNT_ADDRESS]

Then check your balance again:

>spl-token balance [YOUR_MINT_ADDRESS]

Your balance should now reflect the original 900 tokens you kept, plus the 2 tokens collected as fees: 902 total.

#### Step 8: Review the full picture

Run the display command one more time and read through the full output:

>spl-token display [YOUR_MINT_ADDRESS]

Look at what you built in a single session:

A token created under the Token-2022 program
A transfer fee extension enforcing a 2% fee at the protocol level
Metadata giving your token a name, symbol, and URI
Minted supply distributed across accounts
Collected fees from transfers
That is the full lifecycle. No backend server. No middleware. No payment processor. Just on-chain configuration.

