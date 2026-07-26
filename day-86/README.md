## Decide who is allowed to upgrade the program

Yesterday’s mainnet deploy did something quiet that deserves a spotlight. The wallet that signed anchor program deploy did not just pay the rent for your program account. It also became your program’s upgrade authority: the single key on the entire network that is allowed to replace your bytecode with new bytecode. Anyone holding that key can ship a new version of your program to every user who depends on it, with no further permission required.

That is enormous power, and right now it lives in one keypair file on your laptop. If that file leaks, an attacker can rewrite your program. If it is lost, your program can never be upgraded again. Today you take deliberate control of that authority: you will inspect who holds it, transfer it to a different key and back, understand the one-way door that makes a program permanently immutable, and learn why production teams move this authority to a multisig rather than leaving it on a hot wallet.

On a Web2 team, the equivalent of upgrade authority is whoever can push to the main branch that auto-deploys to production, or whoever holds the root credentials to your cloud account. You would never leave that on a personal laptop with no review step, no second approver, and no audit trail. You would put it behind branch protection, required reviewers, and a break-glass procedure.

Solana’s upgradeable loader gives you the same lever, but the defaults are looser than you are used to. A fresh deploy hands full upgrade rights to a single signing key and says nothing about it. Today is the day you treat that key with the seriousness it has earned, before there are real users on the other side of an upgrade.

You will practice the entire authority lifecycle on devnet, where mistakes are free, using your vault program. Everything you learn maps one-to-one onto the mainnet program from yesterday. The only difference is that on mainnet you will run these commands once, slowly, and with a second person watching.

### What you’ll need
- The Solana CLI (this guide assumes solana-cli 3.1.x) and the Anchor CLI from the earlier arcs.
- Your vault program, already deployed to devnet as the staging step in Day 85, and its program ID.
- A dedicated devnet RPC endpoint (free tier from Helius or QuickNode) only if you do the optional program upgrade in step 3 — that step is a full redeploy, and the public devnet RPC cannot reliably complete one. The authority-transfer commands are single transactions and run fine on the public --url devnet. Quote the endpoint URL wherever you use it (the ? is a shell glob character).
- Your terminal, with your default keypair funded on devnet (use solana airdrop 2 --url devnet if your balance is low).
- About 30 minutes and a willingness to read each command’s output before running the next one.

### Steps

Two different things share the word “upgrade” today, and keeping them separate is the whole trick. Upgrade authority is who may change the program — moving it is a single command. A program upgrade is deploying new bytecode — a separate action only the authority holder can do. You will demonstrate the program upgrade first, while you still hold authority (so it is trivial), then spend the rest of the day moving that authority around.

1. Point the CLI at devnet. Every command below talks to the devnet copy you deployed in Day 85.
>solana config set --url devnet

2. Read who holds the authority right now. The Authority field is your default wallet — the key that signed the deploy. You will watch this field change as you move authority around.

>solana program show [YOUR_PROGRAM_ID]

3. (Optional) Prove the upgrade mechanism while you still hold authority. A program upgrade replaces the bytecode, and only the upgrade authority can do it. Doing it now, before you transfer anything, keeps it a single signer: your default wallet is both the fee payer and the authority, so it just works. (This redeploys the same vault.so and costs a little buffer rent — skip it if you would rather not spend the SOL; it does not affect the authority steps.)

>anchor program upgrade [YOUR_PROGRAM_ID] \
>  --program-filepath target/deploy/vault.so \
>  --provider.cluster "[your-devnet-endpoint]"

Two things to notice: anchor program upgrade takes the program ID as a positional argument and the .so as --program-filepath (the reverse of the deprecated anchor upgrade), and --provider.cluster points it at devnet — without it, Anchor uses Anchor.toml’s cluster and you get AccountNotFound. Because a program upgrade is a full redeploy, this is the one step that needs your dedicated RPC endpoint.

4. Create a throwaway key to hand authority to. On devnet this stands in for a teammate’s key or a multisig.
>solana-keygen new --no-bip39-passphrase --outfile new-authority.json

5. Transfer the upgrade authority to it. This is the actual operation the day is named for — one command, signed by the current authority (your default wallet).
>solana program set-upgrade-authority [YOUR_PROGRAM_ID] \
>  --new-upgrade-authority new-authority.json

6. Confirm it moved. Re-read the program; the Authority field is now the new key. From this moment your default wallet can no longer upgrade the program — only new-authority.json can, and it would also have to be funded to pay for a buffer. That is exactly why the optional upgrade in step 3 came first.
>solana program show [YOUR_PROGRAM_ID]

7. Transfer it back. Reversing the move is the same command, now signed by the new authority. Note the recipient is your default wallet’s keypair file, not its pubkey: a transfer requires the new authority to sign too (proof it can control the program), so passing a bare address fails with missing signature for supplied pubkey.
>solana program set-upgrade-authority [YOUR_PROGRAM_ID] \
>  --upgrade-authority new-authority.json \
>  --new-upgrade-authority ~/.config/solana/id.json

(Transferring to a key you cannot sign with here — a multisig, say — instead takes --skip-new-upgrade-authority-signer. Squads’ “Safe Authority Transfer” exists precisely to make that case safe.)

8. The one-way door (do not run casually). --final removes the authority entirely and makes the program permanently immutable. There is no undo, on any cluster. Only ever run this on a program you intend to freeze for good.
>Irreversible. Only ever run this on a program you intend to freeze for good.
>solana program set-upgrade-authority [YOUR_PROGRAM_ID] --final

### Run it
Here is the full safe sequence in order. Swap in your own program ID and wallet address:

>solana config set --url devnet
>solana program show [YOUR_PROGRAM_ID]
>solana-keygen new --no-bip39-passphrase --outfile new-authority.json
>solana program set-upgrade-authority [YOUR_PROGRAM_ID] \
>  --new-upgrade-authority new-authority.json
>solana program show [YOUR_PROGRAM_ID]
>solana program set-upgrade-authority [YOUR_PROGRAM_ID] \
>  --upgrade-authority new-authority.json \
>  --new-upgrade-authority ~/.config/solana/id.json
>solana program show [YOUR_PROGRAM_ID]

#### The production move: a multisig instead of a single key
Transferring authority between two keypairs you both control is the right way to learn the mechanics. It is not where real mainnet programs leave the authority. The professional pattern is to transfer upgrade authority to a multisig, so that shipping a new version requires several independent approvers rather than one signature on one laptop.

The widely used tool for this on Solana is Squads, which is built on a formally verified, audited multisig protocol. You create a Squad, add your program to it, and run a transfer (Squads calls the safer variant a Safe Authority Transfer) so the multisig becomes the program’s upgrade authority. From then on, every upgrade is a transaction that the required number of members must review and sign before it executes. The Squads write-up on managing program upgrades walks through why this matters, including the cautionary tale of single-key authorities exposed during the FTX collapse. You do not need to set this up today; the goal is to know it is the destination for any program with real users.

You took a power that was assigned to you silently and made it something you consciously hold. The Authority field you kept re-reading in solana program show is the hinge that every upgradeable Solana program turns on, and you now know how to read it, move it, and reason about freezing it. That single field is the difference between a program your users can trust and a program that one leaked file could rewrite.

You also felt the asymmetry that makes this worth a whole day. Transferring authority back and forth was reversible and forgiving. The --final flag is neither, and on mainnet even an ordinary transfer to the wrong address has no undo if that address cannot sign back. This is why the muscle memory you built here, inspect before and after every change, matters more on mainnet than the commands themselves. The same discipline that protects a main branch in your Web2 world is the discipline that protects your bytecode here, and now you know exactly which lever to reach for.

