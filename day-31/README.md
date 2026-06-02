## Explore advanced token incentive design

Yesterday, I built a fully branded token on Solana: a name, a symbol, metadata, a minted supply, and a transfer to another wallet. If this were a Web2 platform, I would have just launched my own internal currency. Users can hold it, send it, and see what it is. That is a solid foundation.

But think about the platforms we have used or built in Web2. Almost none of them let value move around for free. Payment processors take a cut of every transaction. Marketplace platforms charge seller fees. Subscription services skim a percentage when creators get paid. These fees are not just revenue; they are how platforms sustain themselves, fund development, and align incentives.

On Solana, I do not need a backend service sitting between users to collect fees on every transfer. The Token-2022 Program, using Solana’s Token Extensions, includes a transfer fee extension that enforces fee collection at the program level. When my token moves from one wallet to another, a percentage of the transfer is automatically withheld in the recipient’s token account, and only the configured withdraw withheld authority can collect it. Any valid transfer of this mint has to respect the fee configuration. Today, I am going to create a token with a built-in transfer fee, move some tokens around, and then collect the fees that were withheld.

### Steps
#### Step 1: Create a token with a transfer fee.

You have created tokens before, but this time you are going to add the transfer fee extension at creation time. Extensions must be configured when the mint is first created; you cannot add them later. The --program-id below points at the Token-2022 Program, which is required for any token using extensions. Run the following command to create a new token with a 1% transfer fee (100 basis points) and a maximum fee of 5,000 base units:

>spl-token create-token --program-id TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb --transfer-fee-basis-points 100 --transfer-fee-maximum-fee 5000

A basis point is 1/100th of a percent, so 100 basis points equals 1%. The maximum fee caps how much can be withheld on a single transfer, regardless of the transfer amount.

Note that --transfer-fee-maximum-fee 5000 is expressed in base units, not whole displayed tokens. The displayed amount depends on the mint’s decimals: with the spl-token CLI default of 9 decimals, 5,000 base units is a very small fraction of one displayed token. If you want the cap to equal 5,000 displayed tokens, you would also need to set --decimals 0 (or scale the value to match your chosen decimals).

Save the mint address from the output; you will need it for the remaining steps.

#### Step 2: Create a token account and mint some supply.

This works just like it did yesterday. Create a token account for your wallet and mint tokens into it:

>spl-token create-account [MINT_ADDRESS]

>spl-token mint [MINT_ADDRESS] 1000

You now have 1,000 tokens in your wallet’s token account.

Step 3: Create a token account for your second wallet.

You need a destination for the transfer. Create the associated token account for your second wallet’s owner address. You will sign and pay for the account creation from your main wallet:

>spl-token create-account [MINT_ADDRESS] --owner [SECOND_WALLET_OWNER_ADDRESS] --fee-payer ~/.config/solana/id.json

[SECOND_WALLET_OWNER_ADDRESS] is the public key of your second keypair (the wallet address), not a token account address. Take note of the token account address that this command prints; you will reuse it in Step 6.

#### Step 4: Transfer tokens and watch the fee get withheld.

When transferring tokens that have a transfer fee, you must include the --expected-fee flag. This is a safety measure: the transfer will only succeed if the fee you specify matches the fee the program calculates. For a transfer of 100 tokens at 1%, the expected fee is 1 token.

Pass the second wallet’s owner address as the recipient and let the CLI resolve to the associated token account you just created:

>spl-token transfer [MINT_ADDRESS] 100 [SECOND_WALLET_OWNER_ADDRESS] --expected-fee 1

Because the destination account already exists, you do not need --allow-unfunded-recipient here.

#### Step 5: Check the balances.

Now look at what happened. Check the balance of both wallets:

>spl-token balance [MINT_ADDRESS]

>spl-token balance [MINT_ADDRESS] --owner [SECOND_WALLET_OWNER_ADDRESS]

Your wallet should show 900 tokens (you sent 100). The second wallet should show 99 tokens, not 100. Where did the other token go? It was withheld. It is sitting in the second wallet’s token account, but the second wallet cannot touch it. Only the withdraw withheld authority — which, by default, is the wallet that created the mint — can collect it.

#### Step 6: Withdraw the withheld fees.

Because your wallet is the withdraw withheld authority (it was set when you created the mint), you can sweep withheld fees out of any token account on this mint and into a destination token account that you control. First, list your own token accounts to find the one that holds your 900 tokens:

>spl-token accounts [MINT_ADDRESS]

The withdraw-withheld-tokens subcommand takes the destination token account first, followed by one or more source token accounts to pull fees from. Use your own token account as the destination and the second wallet’s token account (from Step 3) as the source

>spl-token withdraw-withheld-tokens [YOUR_TOKEN_ACCOUNT_ADDRESS] [SECOND_WALLET_TOKEN_ACCOUNT_ADDRESS]

This pulls the withheld fees from the second wallet’s token account into your token account. Check your balance again to confirm:

>spl-token balance [MINT_ADDRESS]

You should now see 901 tokens: your original 900 plus the 1 token that was withheld as a fee.

