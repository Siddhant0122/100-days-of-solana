## Build a transfer tool
Yesterday I sent SOL transfers on devnet using the CLI. That felt good, but it was also a one-off. The recipient address and amount were specified directly on the command line each time. If you wanted to add balance checks, error handling, or formatted output, you would have to type everything manually. In Web2 terms, you have a working API call but no wrapper around it. Today you turn that into a proper programmatic tool.

Think of it this way: You’ve proved the concept with the CLI. Today you build a programmatic tool around it, the same way a backend developer might wrap a payment SDK call inside an Express endpoint or a CLI utility. By the end of today, you will have a reusable command-line transfer tool that accepts a recipient and an amount as arguments, checks your balance before sending, and reports the result with a link to the transaction on Solana Explorer.

### Steps
1. #### Set up the project

Create a new directory for your transfer tool and initialize it:

>mkdir sol-transfer-tool &amp;&amp; cd sol-transfer-tool

>npm init -y

>npm install @solana/kit @solana-program/system

The @solana/kit package is the modern Solana JavaScript SDK (formerly known as @solana/web3.js 2.0). It is tree-shakable, has zero external dependencies, and uses BigInt for all amounts to match how Solana programs handle numbers in Rust. The @solana-program/system package provides typed helpers for the System Program, including the transfer instruction you need.

Open your package.json and add "type": "module" so you can use ES module imports:

>{
>	"name": "sol-transfer-tool",
>	"version": "1.0.0",
>	"type": "module"
>}

2. #### Generate a second address to receive the transfer

You need a recipient address. Open a second terminal and generate a fresh keypair using the Solana CLI:

>solana-keygen new --outfile ~/.config/solana/recipient.json --no-bip39-passphrase

Copy the public key it prints. That is the address you will pass to your tool.

### Run It
Make sure you have devnet SOL in your default wallet, then run your tool with the recipient address and an amount:

>node transfer.mjs  0.05

### You should see output like this:

#### Solana Transfer Tool
====================
>Connected to Solana devnet.
>Sender: YourPublicKeyHere...
>Recipient: RecipientPublicKeyHere...
>Amount: 0.05 SOL
>Sender balance: 1.5 SOL
>Sending transaction...
>Transaction confirmed!
>Signature: 5Uh3...abc
>Explorer:  https://explorer.solana.com/tx/5Uh3...abc?cluster=devnet
>New sender balance: 1.4499... SOL