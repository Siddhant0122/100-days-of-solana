## Design sustainable token incentive systems

Yesterday, I created my first token on Solana’s devnet. I ran a command, a new mint appeared, and I minted some supply. It worked, but if I looked at that token in an explorer, it was just a string of characters with no name, no symbol, no identity. It was like launching a new rewards program for my platform but forgetting to give it a name or a logo. Users would see a random ID in their account and have no idea what it represents.

In Web2, when everyone design a loyalty system, a virtual currency, or an in-app credit, we give it a brand: a name, a symbol, maybe an icon. I define how many decimal places it supports. I think about how it gets distributed. Today, I am going to do exactly that on Solana. I will build a token from scratch using the Token Extensions Program (also known as Token-2022), give it on-chain metadata (a name, a symbol, and a link to additional details), create a token account to hold it, mint a supply, and then transfer tokens to a second wallet. By the end,  I will have a fully branded, distributable token living on devnet.

### Steps
#### Step 1: Create a token mint with metadata enabled

Yesterday, I created a token using the original SPL Token Program. Today I will use the Token Extensions Program instead. This newer program lets you store metadata directly on the mint account itself, so your token’s name, symbol, and details live right on-chain rather than in a separate account.

The --program-id flag tells the CLI to use the Token Extensions Program, and --enable-metadata activates the metadata extension on your new mint. The --decimals 6 flag sets precision, similar to how USD uses two decimal places for cents. Six decimals is a common choice for fungible tokens on Solana.

Run It
>spl-token create-token \
>  --program-id TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb \
>  --enable-metadata \
>  --decimals 6
Copy the token mint address from the output. You will use it in every step that follows.

#### Step 2: Initialize metadata on your token

Now give your token an identity. The initialize-metadata command writes a name, symbol, and URI directly to the mint account. The URI typically points to a JSON file with extended details (description, image, attributes), similar to how an API endpoint returns metadata about a resource. For this challenge, you can use any public URL or a placeholder.

Run It
>spl-token initialize-metadata [YOUR_TOKEN_ADDRESS] "100DaysCoin" "HUNDO" "https://raw.githubusercontent.com/solana-developers/opos-asset/main/assets/DeveloperPortal/metadata.json"
Replace [YOUR_TOKEN_ADDRESS] with the mint address from Step 1. Feel free to choose your own name and symbol.

#### Step 3: Create a token account

Before you can hold any of your new token, you need a token account. Think of it this way: the mint is the factory that produces the token, and a token account is a wallet’s individual bucket for holding that specific token. In Web2 terms, if the mint is your platform’s rewards program definition, the token account is a specific user’s balance entry in your database.

This command creates an Associated Token Account (ATA) for your wallet. The ATA is a deterministic address derived from your wallet and the token mint, so any sender can find it without you sharing a custom address.

Run It
>spl-token create-account [YOUR_TOKEN_ADDRESS]

#### Step 4: Mint tokens into your account

Now produce some supply. The mint command creates new tokens and deposits them into your token account. Because you set 6 decimals, minting 1000 means 1000 whole tokens (the CLI handles the decimal math for you).

Run It
>spl-token mint [YOUR_TOKEN_ADDRESS] 1000

#### Step 5: Check your balance

Verify that the tokens landed in your account.

Run It
>spl-token balance [YOUR_TOKEN_ADDRESS]
You should see 1000.

#### Step 6: Generate a second wallet and transfer tokens

A token is not much use if it only sits in one account. Generate a second keypair to simulate distributing tokens to another user. Then transfer some of your supply to that new wallet. The --fund-recipient flag tells the CLI to automatically create the recipient’s associated token account if it does not exist yet, covering the small rent cost from your wallet.

Run It
>solana-keygen new --outfile ~/second-wallet.json --no-bip39-passphrase

>spl-token transfer [YOUR_TOKEN_ADDRESS] 250 $(solana-keygen pubkey ~/second-wallet.json) --fund-recipient --allow-unfunded-recipient

#### Step 7: Verify the transfer

Check your balance again, and then check the recipient’s balance to confirm the tokens moved.

Run It
>spl-token balance [YOUR_TOKEN_ADDRESS]

>spl-token balance --owner $(solana-keygen pubkey ~/second-wallet.json) [YOUR_TOKEN_ADDRESS]
You should see 750 in your account and 250 in the second wallet.

