## Test token distribution strategies

I have accomplished quite a lot so far. I created a mint, added metadata, attached transfer fees, and sent tokens between wallets. Every token I have made so far is designed to flow from one account to another. That is the default behavior, and it mirrors what most people expect from digital assets.

But think about our experience in Web2 for a moment. Not everything in a platform is meant to be transferred. A verified badge on a social profile cannot be sold to someone else. A course completion certificate belongs to the person who earned it. An employee ID does not change hands. These are credentials, not currencies. Their value comes from who holds them, not from being tradeable.

Solana’s Token Extensions Program has a built-in answer for this: the non-transferable extension. When you enable it on a mint, every token created from that mint is permanently locked to the wallet it lands in. No transfers, no secondary markets, no workarounds. The blockchain enforces it at the protocol level. Today, I am going to experiment with creating one of these “soulbound” tokens, mint it, and then try to transfer it just to watch it fail. That failure is the whole point.

### Steps
#### Step 1: Confirm your setup.

Make sure you are on devnet and have SOL to work with. Run the following commands to check:

>solana config set --url devnet

>solana balance

If your balance is low, request an airdrop:

>solana airdrop 2

> Note: The devnet airdrop can sometimes fail due to rate limiting. If this happens use the web faucet instead.

#### Step 2: Create a non-transferable token mint.

This is where the experiment begins. You are going to create a new token mint using the Token Extensions Program (Token-2022), but this time you will pass the --enable-non-transferable flag. This flag tells the program to permanently prevent any token minted from this mint from being transferred between wallets.

Run It
>spl-token create-token --program-id TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb --enable-non-transferable

Copy the mint address from the output. You will need it for the next steps.

#### Step 3: Create a token account and mint some tokens.

Even though these tokens cannot be transferred, you still need a token account to hold them. Create one and then mint a supply to it:

>spl-token create-account YOUR_MINT_ADDRESS --program-id TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb

>spl-token mint YOUR_MINT_ADDRESS 10 --program-id TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb

You should now have 10 tokens sitting in your wallet. Check the balance to confirm:

>spl-token balance YOUR_MINT_ADDRESS --program-id TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb

#### Step 4: Try to transfer. Watch it fail.

Now for the experiment. Generate a second keypair to act as another wallet, create a token account for it, and then try to send tokens to it:

>solana-keygen new --outfile ~/experiment-wallet.json --no-bip39-passphrase --force

>spl-token create-account YOUR_MINT_ADDRESS --owner ~/experiment-wallet.json --fee-payer ~/.config/solana/id.json --program-id TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb

>spl-token transfer YOUR_MINT_ADDRESS 5 EXPERIMENT_WALLET_PUBLIC_KEY --program-id TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb --allow-unfunded-recipient

>That last command should fail. The error will tell you the transfer is not allowed. This is not a bug. This is the non-transferable extension doing exactly what it is designed to do. The blockchain itself is rejecting the transaction.

#### Step 5: Prove that burning still works.

Non-transferable does not mean non-destructible. The token owner can still burn tokens they hold. Try it:

>spl-token burn YOUR_TOKEN_ACCOUNT_ADDRESS 3 --program-id TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb

Check your balance again:

>spl-token balance YOUR_MINT_ADDRESS --program-id TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb

You should now have 7 tokens. The burn went through. The transfer did not. That distinction is what makes non-transferable tokens useful.

