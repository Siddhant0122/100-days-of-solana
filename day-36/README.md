## Create an Interest-Bearing Token on Solana

Every fintech app I have used in Web2 shows me a interest rate. Savings accounts display APY. Lending platforms show accrued interest in real time. The number in our balance ticks upward without you doing anything. It feels like magic, but it is really just math applied to a timestamp.

Solana has this concept built directly into the token layer. The Token Extensions Program includes an interest-bearing extension that attaches a continuous compounding rate to any mint. The balances on-chain do not actually change; instead, any wallet or application that reads the token uses a formula to display an interest-adjusted amount based on how much time has passed. Think of it like a savings account where the “display balance” grows over time, but the ledger entry stays the same until someone explicitly mints or transfers tokens.

Today, I am going to create an interest-bearing token from scratch using the CLI. I will set a rate, check how the UI amount differs from the raw balance, and see how Solana handles time-based calculations at the protocol level.

### Steps
#### Step 1: Confirm you are on devnet and have SOL to work with:

>solana config get

>solana balance

You need at least 0.5 SOL for the rent costs of creating a mint and token account.

#### Step 2: Create a new token mint with the interest-bearing extension enabled. The rate is specified in basis points, where 100 basis points equals 1%. You will set a 5% annual rate (500 basis points):

>spl-token create-token \
  --program-id TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb \
  --interest-rate 500

The --program-id flag tells the CLI to use the Token-2022 program (Token Extensions) instead of the original SPL Token program. Save the mint address that gets printed; you will need it in the next steps.

#### Step 3: Create a token account for your new mint:

>spl-token create-account YOUR_MINT_ADDRESS \
  --program-id TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb

#### Step 4: Mint 1000 tokens to your account:

>spl-token mint YOUR_MINT_ADDRESS 1000 \
  --program-id TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb

#### Step 5: Check your raw token balance:
>spl-token balance YOUR_MINT_ADDRESS \
  --program-id TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb

This will show 1000. Now check the interest-adjusted UI amount:
>spl-token display YOUR_MINT_ADDRESS \
  --program-id TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb

Look for the interest-bearing configuration in the output. You should see your rate (500 basis points) and the initialization timestamp.

#### Step 6: Wait a few minutes, then check the UI amount again using the amountToUiAmount approach. You can query this through the Solana RPC:

>solana account YOUR_MINT_ADDRESS --output json

The interest-adjusted display amount will be slightly higher than 1000, because continuous compounding has been applied since the moment you minted. At 5% annual, you will not see a dramatic change in minutes, but the math is running.

#### Step 7: Update the interest rate to something more dramatic so you can observe the effect more clearly. Set it to 150% (15000 basis points):

>spl-token set-interest-rate YOUR_MINT_ADDRESS 15000

Now wait another minute or two and check the display amount again. The growth should be noticeably faster.

