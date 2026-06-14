## Send your fee-bearing token and harvest the withheld fees

Yesterday you created a fee-bearing token on devnet. You configured the basis points, you set a maximum fee, and you watched Token-2022 bake the rule directly into the mint. The mint exists, but it has not done anything yet. A token that just sits there is not a token. It is a row in a database.

Today you put it in motion. In your Web2 life you would test a payment processor by sending a few cents through it and reading the receipts on the dashboard. Solana lets you do something similar without a dashboard, without an API key, and without a sandbox. You will spin up a fresh wallet, transfer some of your token to it, and then read the recipient’s account directly to see the fee that the protocol withheld for you. Then you will pull those withheld tokens back out using the withdraw authority you set yesterday.

By the end you will have observed the entire fee lifecycle on chain: transfer, withhold, withdraw. No middleware. No webhook. The mint did the work.

### Steps
#### Step 1: Confirm you are still on devnet and that the CLI can see your wallet:
>solana config set --url https://api.devnet.solana.com
>solana address
>solana balance

If your balance is low, top up with solana airdrop 2.

Note: The devnet airdrop can sometimes fail due to rate limiting. If this happens use the web faucet instead.

#### Step 2: Export the mint address from yesterday into a shell variable so the next commands stay readable. Replace the placeholder with your actual mint address:
>export MINT=[PASTE_YOUR_MINT_ADDRESS_HERE]

#### Step 3: Mint a fresh batch of supply to your own wallet so you have something to send. The number is a UI amount, so this mints one million whole tokens:
>spl-token mint $MINT 1000000

#### Step 4: Generate a brand new keypair to act as your recipient. This wallet is throwaway and lives only on your machine:
>solana-keygen new --no-bip39-passphrase --outfile recipient.json
>export RECIPIENT=$(solana address -k recipient.json)
>echo "Recipient wallet: $RECIPIENT"

#### Step 5: Create the recipient’s associated token account for this mint up front. The recipient’s throwaway wallet has no SOL, so you pay the rent yourself with --fee-payer. Creating the account explicitly means you can see exactly which address holds the tokens before any transfer happens:
>spl-token create-account $MINT \
>  --owner $RECIPIENT \
>  --fee-payer ~/.config/solana/id.json

#### Step 6: Transfer 1000 tokens to the recipient. The --expected-fee flag tells the runtime exactly how much fee you expect to be withheld and aborts the transfer if the math does not match. Yesterday’s mint charges 100 basis points (1 percent), so the fee on 1000 tokens is 10 tokens. Set the expected fee accordingly. If you used different basis points yesterday, recalculate the fee as amount * basisPoints / 10000. There is no --fund-recipient flag here on purpose: the CLI cannot create an account on the fly for a mint that charges a transfer fee, which is exactly why you created the recipient’s account explicitly in the previous step. The recipient wallet holds no SOL, so --allow-unfunded-recipient lets the transfer proceed to the account you already created:
>spl-token transfer \
>  --expected-fee 10 \
>  $MINT 1000 $RECIPIENT \
>  --allow-unfunded-recipient

#### Step 7: Find the recipient’s token account address so you can inspect it:
>spl-token accounts --owner $RECIPIENT --verbose

Copy the token account address from the output and save it:
>export RECIPIENT_TA=[PASTE_RECIPIENT_TOKEN_ACCOUNT_HERE]

#### Step 8: Read the recipient’s token account directly on chain. Look for the TransferFeeAmount extension and the withheld_amount field. That is the slice the protocol kept for you, sitting on the recipient’s account, untouchable by the recipient:
>spl-token display $RECIPIENT_TA

#### Step 9: Find your own associated token account for this mint so you have somewhere to withdraw the fees back into. Scoping to $MINT keeps the output to just this token instead of every account your default wallet owns:
>spl-token accounts $MINT --verbose

Save your token account address for this mint:
>export MY_TA=[PASTE_YOUR_TOKEN_ACCOUNT_HERE]

#### Step 10: Withdraw the withheld fees from the recipient’s account into your own token account. This call uses the withdraw authority you set yesterday, which by default is your wallet:
>spl-token withdraw-withheld-tokens $MY_TA $RECIPIENT_TA

#### Step 11: Confirm the loop closed. The recipient’s withheld amount should now be zero, and your own balance should reflect the 10 tokens you just reclaimed:
>spl-token display $RECIPIENT_TA
>spl-token balance $MINT

Run it
>spl-token create-account $MINT --owner $RECIPIENT --fee-payer ~/.config/solana/id.json
>spl-token transfer --expected-fee 10 $MINT 1000 $RECIPIENT --allow-unfunded-recipient
>spl-token display $RECIPIENT_TA
>spl-token withdraw-withheld-tokens $MY_TA $RECIPIENT_TA
