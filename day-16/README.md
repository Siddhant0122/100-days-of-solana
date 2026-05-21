## Send your first SOL transfer
Yesterday cracked open a transaction and studied its anatomy. I saw signatures, instructions, account keys, and blockhashes. Now it’s time to build own transfer from scratch using the Solana CLI. I already sent a quick transfer yesterday to get a transaction to inspect. Today I’ll do it more deliberately, step by step.

Today, I will send a deliberate SOL transfer on devnet, understanding every step. If you have ever used a payment API like Stripe or PayPal, you know the flow: authenticate, specify a recipient, set an amount, and submit. A Solana transfer follows the same pattern, except there is no middleman. Your transaction goes directly to the network, gets validated by thousands of nodes, and settles in under a second. No webhook callbacks, no pending states, no three-to-five business days.

Steps
1. ### Confirm your CLI is pointed at devnet. 
    Devnet is Solana’s testing network where you can experiment freely with no real money at stake. Run:
>solana config set -ud

    Then verify your configuration:
>solana config get

    You should see RPC URL: https://api.devnet.solana.com in the output.

2. ### Check your current balance.
>solana balance

    If your balance is zero or too low, airdrop some devnet SOL to yourself:
>solana airdrop 2

    This gives you 2 SOL on devnet to work with. Devnet airdrops are capped at 5 SOL per request. If you get rate-limited, you can also use the Solana Web Faucet as a backup.

3. ### Generate a second keypair to use as your recipient. 
    You need someone to send SOL to. Create a throwaway keypair:
>solana-keygen new --outfile ~/recipient-keypair.json --no-bip39-passphrase

    Note the public key it outputs. That is your recipient address.

4. ### Send the transfer. 
    Replace `` with the public key from the previous step:
>solana transfer `` 0.5 --allow-unfunded-recipient

    The --allow-unfunded-recipient flag is necessary because your new recipient address has never received SOL before and does not yet have an account on-chain. Without this flag, the CLI would reject the transfer as a safety measure.

5. ### Verify the transfer landed. 
    Check your own balance and the recipient’s balance:
>solana balance
>solana balance

    Your balance should be roughly 1.5 SOL (2 minus 0.5, minus a tiny transaction fee). The recipient should show 0.5 SOL.

6. ### Look up your transaction on the explorer. 
    When you ran the transfer command, the CLI printed a transaction signature (a long string of characters). Copy it and open this URL in your browser, replacing `` with your actual signature:
>https://explorer.solana.com/tx/?cluster=devnet

    Browse the transaction details. You will see the sender, recipient, amount, fee, and the block it was included in.
