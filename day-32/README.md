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

