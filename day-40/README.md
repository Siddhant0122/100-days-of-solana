## Design a Revocable Credential Token with Non-Transferable and Permanent Delegate Extensions

In Web2, credentials and certifications follow a specific lifecycle. A coding bootcamp issues you a certificate of completion. You cannot sell it or give it to someone else; it belongs to you. But the issuing institution retains the right to revoke it if they discover fraud or if the credential expires. Think of professional licenses, employee badges, or verified status markers on social platforms. They are yours to hold, but someone else controls whether they remain valid.

Over the past few days, you have built tokens with transfer fees, metadata, and frozen account states. Today you are going to experiment with two extensions you have not used yet: the non-transferable extension and the permanent delegate extension. Combined, these let you create a token that cannot be moved between wallets (soulbound) but can still be burned by a designated authority (revocable). You will also layer on metadata so the credential carries human-readable information. This is an experiment day, so you have room to try things, observe what works, and learn from any errors you encounter along the way.

### Steps
#### Step 1: Create a non-transferable token with a permanent delegate and metadata

You are going to combine three extensions in a single mint. The non-transferable extension locks the token in place once minted. The permanent delegate extension gives your authority keypair the ability to burn tokens from any account. The metadata extension attaches human-readable information directly on-chain.

Run it

>spl-token --program-id TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb create-token \
>  --decimals 0 \
>  --enable-non-transferable \
>  --enable-permanent-delegate \
>  --enable-metadata

Save the mint address from the output. You will need it throughout this experiment. Note that you use --decimals 0 because credentials are whole units; you either have one or you do not.

#### Step 2: Initialize the token metadata

Now give your credential a name, symbol, and URI. The URI would typically point to a JSON file with additional details about the credential, but for this experiment a placeholder works fine.

Run it

>spl-token initialize-metadata [MINT_ADDRESS] \
  "Solana Dev Credential" \
  "CRED" \
  "https://example.com/credential.json"

#### Step 3: Create a token account for the recipient and mint one credential

Generate a second keypair to act as your recipient. In a real scenario, this would be the wallet of a developer who earned the credential.

Run it

>solana-keygen new --outfile ~/recipient-wallet.json --no-bip39-passphrase --force
>RECIPIENT=$(solana-keygen pubkey ~/recipient-wallet.json)
>spl-token create-account [MINT_ADDRESS] --owner $RECIPIENT \
>  --fee-payer ~/.config/solana/id.json \
>  --program-id TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb

>spl-token mint [MINT_ADDRESS] 1 --recipient-owner $RECIPIENT \
>  --program-id TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb

#### Step 4: Verify the token cannot be transferred

Now experiment. Try to transfer the credential from the recipient to another address. This should fail because the non-transferable extension blocks all transfers after minting.

Run it

>solana-keygen new --outfile ~/third-party.json --no-bip39-passphrase --force
>THIRD_PARTY=$(solana-keygen pubkey ~/third-party.json)
>spl-token transfer [MINT_ADDRESS] 1 $THIRD_PARTY \
>  --owner ~/recipient-wallet.json \
>  --fee-payer ~/.config/solana/id.json \
>  --program-id TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb \
>  --fund-recipient --allow-unfunded-recipient

You should see an error indicating the transfer is not allowed. Read the error message carefully. It confirms that the non-transferable extension is working as intended.

#### Step 5: Revoke the credential using the permanent delegate

Now simulate the issuing authority revoking the credential. Because your default keypair is the permanent delegate, you can burn the token from the recipient’s account without their signature.

Run it

>spl-token burn [RECIPIENT_TOKEN_ACCOUNT_ADDRESS] 1 --owner ~/.config/solana/id.json \
>  --program-id TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb

If the burn succeeds, the credential has been revoked. The recipient no longer holds any tokens. Confirm this by checking their balance:

>spl-token balance [MINT_ADDRESS] --owner $RECIPIENT \
>  --program-id TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb

#### Step 6: Inspect the mint to confirm all extensions are present

Use the display command to review the full extension configuration of your mint, just like you practiced on the previous Reinforce day.

Run it

>spl-token display [MINT_ADDRESS] \
>  --program-id TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb

In the output, look for the non-transferable flag, the permanent delegate address, and the metadata fields you set earlier. All three extensions should be visible in the account data.

