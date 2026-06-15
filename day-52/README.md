## Stack interest accrual on top of your fee-bearing token

In your Web2 life you have probably opened a high yield savings account. The bank pays you interest while you hold the money. The bank also charges a fee when you wire it somewhere. Two behaviors, one account, both quietly running in the background while you go about your day.

You already built half of that on Solana. Your fee-bearing token from Token-2022 charges a configurable fee on every transfer and lets the mint authority sweep those fees later. The other half, the yield part, is also just an extension. The Interest-Bearing extension lets you set an annual rate directly on the mint, and the protocol does the compounding math for you forever.

Today you stretch what you know by stacking both extensions on a single mint. One mint, one create-token command, two behaviors. By the end you will have a token that charges a transfer fee every time it moves AND that quietly grows in value the entire time you hold it. You will also discover a subtle but important detail about how Token-2022 reports balances, which is one of the most common “gotchas” Web2 developers run into when they first work with these extensions.

### Steps

#### Step 1: Confirm your environment is healthy. You should be on devnet and have a balance that covers a couple of rent-exempt accounts.
#### Step 2: Create a brand new mint that combines two extensions in a single invocation. The --transfer-fee-basis-points flag sets the fee rate and --transfer-fee-maximum-fee sets the maximum raw fee per transfer. The --interest-rate flag takes a single integer in basis points, where 10000 basis points equals 100 percent APR. To make the interest visible inside one coffee break, use an unrealistically high rate.
#### Step 3: Display the mint and read every line of the output. You should see TransferFeeConfig AND InterestBearingConfig populated. Confirm both extensions made it onto the same TLV (type-length-value) blob inside the mint account.
#### Step 4: Create an associated token account for yourself on the new mint, then mint a generous supply so the interest math produces visible digits.
#### Step 5: Run spl-token accounts on your token account and write down the UI amount. Wait roughly 30 seconds. Run it again. Write down the new UI amount. The numbers should be different even though you have not sent a transaction in between.
#### Step 6: Now move some tokens. Generate a fresh keypair, fund it with a tiny amount of SOL from your wallet, and transfer a chunk of your token supply to it. Use the --expected-fee flag the same way you did on Day 51 so the transfer instruction acknowledges the fee.
#### Step 7: Display the recipient’s token account. Confirm two things at once. First, the fee was withheld on the recipient side, exactly like it did on Day 51. Second, the recipient’s UI amount is already drifting upward because the interest-bearing extension applies to every account on the mint, not just yours.
#### Step 8: As a final check, withdraw the withheld fees back to your wallet using the same withdraw-withheld-tokens flow from yesterday. Confirm that your mint authority still works on a multi-extension mint.

#### Run it
##### 1. Sanity check the environment
>solana config set --url https://api.devnet.solana.com
>solana balance

##### 2. Create a multi-extension mint
##### --transfer-fee-basis-points 100 means a 1% fee
##### --transfer-fee-maximum-fee 1000000 is read as a UI amount, so the cap is 1,000,000 whole tokens (never binds on normal transfers)
##### --interest-rate 5000 means 50% APR, expressed in basis points
>spl-token create-token \
>  --program-id TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb \
>  --decimals 6 \
>  --transfer-fee-basis-points 100 \
>  --transfer-fee-maximum-fee 1000000 \
>  --interest-rate 5000

##### Save the resulting mint address. Export it for convenience.
>export MINT=[paste-your-mint-address-here]

##### 3. Inspect both extensions on the mint
>spl-token display $MINT

##### 4. Create your token account and mint a healthy supply
>spl-token create-account $MINT

##### The line above prints your new token account address.
##### Paste it here so later steps can reuse it:
>export MY_TA=[paste-your-token-account-here]
>spl-token mint $MINT 1000000

##### 5. Snapshot the UI amount twice with a pause in between
>spl-token accounts $MINT --verbose | awk 'NR==3'
>sleep 30
>spl-token accounts $MINT --verbose | awk 'NR==3'

##### 6. Send some tokens to a fresh wallet, paying the expected fee
>solana-keygen new --no-bip39-passphrase --outfile ~/recipient.json
>RECIPIENT=$(solana-keygen pubkey ~/recipient.json)
>solana transfer $RECIPIENT 0.01 --allow-unfunded-recipient

##### The CLI cannot create an account on the fly for a fee-bearing mint, so create it explicitly first
>spl-token create-account $MINT --owner $RECIPIENT --fee-payer ~/.config/solana/id.json

##### The line above prints the recipient's new token account address.
##### Paste it here so the next steps can reuse it:
>export RECIPIENT_TA=[paste-recipient-token-account-here]
>spl-token transfer $MINT 1000 $RECIPIENT \
>  --expected-fee 10
>  --allow-unfunded-recipient

##### 7. Display the recipient's account and look for both fee withholding and interest accrual
>spl-token display $RECIPIENT_TA

##### 8. Sweep the withheld fees back to your wallet
>spl-token withdraw-withheld-tokens $MY_TA $RECIPIENT_TA

