## Make a token that refuses to move

By now you have shipped tokens that behave like financial instruments. Your Day 50 and 51 mint skims a fee on every transfer. Your Day 52 mint stacks interest on top of that fee. Yesterday you ran the Solana equivalent of DESCRIBE across both and confirmed every extension you had baked in. You have been building money.

Today you are going to build the opposite of money. You are going to mint a token that cannot be sent anywhere once it lands in an account. In the Web2 world this is the closest thing to a certificate of completion stapled to a profile page. Nobody can detach it. Nobody can resell it. The holder is the holder forever. Token-2022 calls this the non-transferable extension, and the rest of the ecosystem usually calls the result a soul-bound token.

This is an experiment day, so you are going to break it on purpose. You will mint the token to yourself, confirm it lives in your account, then try to transfer it and watch the runtime reject you. That rejection is the feature. Seeing the error message land is the whole point.

### Steps
#### Step 1: Confirm your CLI is pointed at devnet and that you have some SOL to spend. You should be familiar with both of these commands by now from earlier in the arc.
#### Step 2: Create a brand new mint with the non-transferable extension turned on. This is a one-shot flag on the create-token subcommand. Keep the mint address handy, you will need it for the next three steps.
#### Step 3: Create an associated token account for that mint under your own wallet. This is the only account that will ever hold a balance of this token, and you will see why in a moment.
#### Step 4: Mint exactly one unit of the token into your own account. Treat it like awarding yourself a badge.
#### Step 5: Generate a throwaway recipient keypair so you have a second address to aim at. You do not need to fund it for this experiment, you only need its public key.
#### Step 6: Create the recipient’s associated token account first, paying the rent yourself since the throwaway wallet has no SOL. Then attempt to transfer your one token to it. Creating the account up front means the transfer actually reaches the program and is refused by the extension, instead of being refused by the CLI for an unrelated reason like a missing or unfunded destination account.
#### Step 7: Read the error carefully. Note which program returned it and which instruction failed. This is the moment the extension earns its name.
#### Step 8: For one last sanity check, run spl-token display against your mint and confirm the non-transferable line is present in the output. Yesterday you learned how to read that output, so today it should feel routine.

#### Run it

##### 1. Confirm you are on devnet with some SOL to spend
>solana config set --url https://api.devnet.solana.com
>solana balance

##### 2. Create the non-transferable mint under the Token-2022 program
>spl-token create-token --program-2022 --enable-non-transferable

##### Export the mint address the previous command printed
>export MINT=[paste-your-mint-address-here]

##### 3. Create your associated token account for that mint
>spl-token create-account $MINT

##### 4. Mint one token to yourself
>spl-token mint $MINT 1

##### 5. Generate a throwaway recipient
>solana-keygen new --no-bip39-passphrase --outfile /tmp/recipient.json --force
>export RECIPIENT=$(solana-keygen pubkey /tmp/recipient.json)

##### 6. Create the recipient's token account up front so the transfer can reach the program
##### (you pay the rent since the throwaway wallet has no SOL), then attempt the transfer.
>spl-token create-account $MINT --owner $RECIPIENT --fee-payer ~/.config/solana/id.json
>spl-token transfer $MINT 1 $RECIPIENT --allow-unfunded-recipient

##### 7. Read the error above. It should be a non-transferable rejection from the program.

##### 8. Confirm the extension is on the mint
>spl-token display $MINT

#### What Just Happened
You minted a token whose entire purpose is to never move. The non-transferable extension is encoded into the mint account itself, which means the rule travels with the asset. Any wallet, any program, any client that talks to the Token-2022 program has to honor it. You did not need a custom program. You did not need to write a single line of Rust. You flipped a flag at creation time, and the runtime took it from there.

The failed transfer is the proof. In your Web2 life you might have enforced something like this at the application layer with a database constraint or a check in an API handler. The risk of that approach is that anyone who talks to the database around your application can break the rule. On Solana, the rule lives on the asset, inside the program that owns the asset, inside the validator that runs the program. There is no around. The error you just read came from the protocol itself refusing the instruction.

This is also the first Token-2022 extension you have shipped that is not about money. Fees and interest were quantitative behaviors layered onto a currency. Non-transferable is a qualitative behavior that turns the same primitive into an identity object. Same mint, same accounts, same CLI you have been using all arc. Different shape entirely.

