## Create a Compliance-Gated Token with Default Frozen Accounts

In Web2, plenty of platforms gate access before users can transact. A brokerage account requires identity verification before you can buy stocks. A payments app freezes your account until you confirm your email. A gaming platform locks in-game currency transfers until you accept the terms of service. The pattern is always the same: accounts start locked, and an authority decides when to unlock them.

Solana’s Default Account State extension encodes this pattern directly into the token mint. When you create a mint with the default state set to frozen, every single token account created for that mint starts in a frozen state. No one can receive, send, or burn tokens until the freeze authority explicitly thaws their account. This is not application logic you bolt on after the fact. It is enforced at the protocol level, which means no frontend bug or API misconfiguration can accidentally bypass it.

Today I am going to stretch beyond combining extensions and build a permissioned token system. I will create a mint where accounts are frozen by default, create multiple token accounts, selectively approve (thaw) specific accounts, and observe what happens when I try to interact with a still-frozen account. This is the kind of access control pattern that real-world regulated assets use on Solana.

### Steps
1. Create a token mint with the default account state set to frozen. This single flag tells the Token Extensions Program that every new token account for this mint should start in a frozen state. You also need --enable-freeze because the freeze authority is what allows you to thaw accounts later.

2. Create two separate token accounts for the mint. You will use these to demonstrate that both start frozen and that you can selectively approve one while leaving the other locked.

3. Attempt to mint tokens to one of the frozen accounts. Observe the error. This confirms that the default frozen state is actively enforced.

4. Thaw one of the accounts using the freeze authority. This simulates the “approval” step, like a compliance check passing or a user completing verification. Note that spl-token thaw takes a token account address, not the owner’s wallet address.

5. Mint tokens to the thawed account. This should succeed now that the account is in the initialized state.

6. Attempt to transfer tokens from the thawed account to the still-frozen account. Observe the error. Even though the sender is approved, the recipient must also be thawed to receive tokens.

7. Thaw the second account, then retry the transfer. Now both accounts are approved and the transfer completes.

Run it
##### Step 1: Create a mint with default frozen accounts
>spl-token create-token \
>  --program-id TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb \
>  --enable-freeze \
>  --default-account-state frozen
> Save your mint address from the output
> Example: MINT_ADDRESS=[your-mint-address]

##### Step 2: Create two token accounts
>spl-token create-account [MINT_ADDRESS]

###### Generate a second keypair to simulate a second user
>solana-keygen new --outfile ~/second-wallet.json --no-bip39-passphrase --force
>SECOND_WALLET=$(solana-keygen pubkey ~/second-wallet.json)
>spl-token create-account [MINT_ADDRESS] --owner $SECOND_WALLET --fee-payer ~/.config/solana/id.json

##### Step 3: Try to mint to your (frozen) account — this will FAIL
>spl-token mint [MINT_ADDRESS] 100
###### You should see an error: "Account is frozen"

##### Step 4: Thaw your own token account
>spl-token thaw [YOUR_TOKEN_ACCOUNT_ADDRESS]

##### Step 5: Mint tokens to your now-thawed account
>spl-token mint [MINT_ADDRESS] 100

##### Step 6: Try to transfer to the second (still frozen) account — this will FAIL
>spl-token transfer [MINT_ADDRESS] 50 $SECOND_WALLET --allow-unfunded-recipient
###### You should see an error because the destination is frozen

##### Step 7: Thaw the second account, then transfer
>spl-token thaw [SECOND_TOKEN_ACCOUNT_ADDRESS]
>spl-token transfer [MINT_ADDRESS] 50 $SECOND_WALLET --allow-unfunded-recipient

##### Verify balances
>spl-token accounts --owner $SECOND_WALLET