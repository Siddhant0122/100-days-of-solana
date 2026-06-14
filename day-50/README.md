## Create a fee-bearing token with Token-2022

Web2 bridge: Token extensions are like middleware for your currency, adding features without changing the core protocol

You have spent the last arc minting NFTs using Token-2022. You stamped metadata directly on the mint. You grouped tokens into a collection. You audited every byte and even mutated a field live on devnet. Without saying it out loud, you have already been playing with token extensions.

Token extensions are like middleware for your currency. In your Web2 life, if you wanted to charge a fee on every payment, you would wire up something at the payment processor layer. You would write a little function that wraps the transfer and skims off a percentage before forwarding the rest. The transfer itself stays dumb, your middleware does the smart thing.

Solana flips that. Instead of the middleware living next to the asset, the middleware lives inside the asset. You bake the fee directly into the mint. Every wallet, every program, every CLI, every dApp that transfers your token automatically respects that fee, because the rule is part of the token itself. Today you create one of those tokens and confirm with your own eyes that the rule is sitting on chain.

### Steps
#### Step 1: Confirm your CLI is pointed at devnet so you do not accidentally burn real SOL on this experiment.
#### Step 2: Create a new fungible mint using the Token-2022 program and attach the Transfer Fee extension. You will set a fee of 100 basis points (1 percent of every transfer) and a maximum fee cap of 1000000. The CLI reads this number as a UI amount, so the cap works out to 1,000,000 whole tokens, high enough that it never kicks in on a normal transfer and the full 1 percent applies every time.
#### Step 3: Copy the mint address that the CLI prints back at you. You will need it for the next steps and for tomorrow’s Build day.
#### Step 4: Create an associated token account for yourself so this mint has somewhere to land.
#### Step 5: Mint a small starting supply to your own wallet so the token is not empty.
#### Step 6: Display the mint and look for the TransferFeeConfig section in the output. That is the proof that your middleware is on chain.

Run it
Point at devnet and check the active keypair has some SOL:

>solana config set --url https://api.devnet.solana.com
>solana balance

Create the fee-bearing mint. The long string after --program-id is the on chain address of the Token-2022 program:

>spl-token --program-id TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb \
>  create-token \
>  --transfer-fee-basis-points 100 \
>  --transfer-fee-maximum-fee 1000000 \
>  --decimals 6

Save the mint address that gets printed. Then create a token account for it and mint yourself a starting supply of 1,000 tokens:

>spl-token create-account [YOUR_MINT_ADDRESS]
>spl-token mint [YOUR_MINT_ADDRESS] 1000

Now ask the chain to describe your mint:

>spl-token display [YOUR_MINT_ADDRESS]

In the output, look for a section that reads Extensions. Inside it you should see TransferFeeConfig with your basis points and maximum fee. That is the on chain receipt for the rule you just baked in.

