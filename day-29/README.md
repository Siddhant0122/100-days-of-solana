## Exploring token economics and incentives

Up until now, I have been working with SOL: sending it, reading account balances, exploring how it moves through the network. SOL is the native currency of Solana, the fuel that powers every transaction. But Solana’s real power goes far beyond a single currency. Think about the platforms everyone built or used in Web2. Most of them have some kind of internal token system, whether it’s credits, reward points, in-app currency, or loyalty points. Payment processing services have balance transactions. Gaming platforms have virtual coins. Social platforms have karma or reputation scores. These systems let platforms create incentives, reward behavior, and unlock features.

On Solana, that concept is built into the protocol itself. Any developer can create a new token, define its rules, and distribute it, all without asking permission or spinning up a custom backend. The program that makes this possible is called the SPL Token Program, and today   I are going to use it for the first time. I will create my very own token on Solana’s devnet, mint some supply, and inspect the results. By the end of this challenge, I will have a token that exists on-chain with my wallet as its creator and authority.

### Steps
#### Step 1: Confirm your CLI is pointed at devnet

Before doing anything with tokens, make sure your Solana CLI is configured for devnet. Run the following command:

>solana config set --url devnet
You should see output confirming your RPC URL is set to https://api.devnet.solana.com. Then verify your wallet address:

>solana address

#### Step 2: Airdrop some devnet SOL

Creating a token requires a small amount of SOL to pay for the on-chain account that stores the token’s data. Airdrop some devnet SOL to cover this:

>solana airdrop 2
>Note: The devnet airdrop can sometimes fail due to rate limiting. If this happens use the web faucet instead.

Confirm your balance with "solana balance". You should see 2 SOL (or more if you had some left from earlier days).

#### Step 3: Create your token

Now for the main event. Run this command to create a brand new token on devnet:

>spl-token create-token
The output will show you a token mint address, something like 7Kz...xYz. Copy this address and save it somewhere. This is the unique identifier for the token you just created. On Solana, this is called a Mint account. It stores the global state of your token: its total supply (currently zero), its number of decimal places (defaulting to 9), and the authority that is allowed to mint more (your wallet).

#### Step 4: Create a token account to hold your tokens

Here is something that might feel different from Web2. On Solana, you cannot just receive tokens into your wallet directly. Your wallet needs a dedicated token account for each type of token it holds. Think of it like this: if your wallet is a filing cabinet, each token account is a separate folder inside it, one for each type of token you own.

Create a token account for your new token:

>spl-token create-account YOUR_TOKEN_MINT_ADDRESS
Replace YOUR_TOKEN_MINT_ADDRESS with the mint address from Step 3. The CLI will output the address of your new token account.

#### Step 5: Mint some tokens

Your token exists, and you have an account ready to hold it. Now let’s create some supply. Mint 100 tokens into your token account:

>spl-token mint YOUR_TOKEN_MINT_ADDRESS 100
This creates 100 new units of your token and deposits them into your token account. You are the mint authority, so only you can do this.

#### Step 6: Inspect what you built

Now take a look at what you have created. Run these commands one at a time and read the output carefully:

>spl-token supply YOUR_TOKEN_MINT_ADDRESS
This shows the total supply of your token across all holders (right now, just you).

>spl-token accounts
This lists every token your wallet holds, along with the balance for each. You should see your new token with a balance of 100.

>spl-token display YOUR_TOKEN_MINT_ADDRESS
This gives you a detailed view of the Mint account itself: supply, decimals, mint authority, and more.