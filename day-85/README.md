## Take an Anchor program from staging to production
Arc theme: Deployment

Web2 bridge: Deploying to mainnet is like going from staging to production

The vault program you built, fuzzed, and attacked across the last arc has only ever lived in places where mistakes are free. Devnet hands out SOL for the asking, LiteSVM spins up a fresh chain for every test, and surfpool resets the moment you close it. Today that changes. You are going to put your program on mainnet-beta, the one Solana cluster where the SOL is real, the accounts persist for everyone, and the program ID you publish becomes an address other people can build against.

This is the staging-to-production moment. The good news is that the mechanics are almost identical to a devnet deploy: the same anchor build, the same .so artifact, the same deploy command. What changes is the surrounding discipline. There is no airdrop to bail you out, a half-finished deploy can strand real lamports in a buffer account, and the wallet that signs the deploy quietly becomes the program’s upgrade authority. We will walk through each of those carefully so your first mainnet deploy is a calm, deliberate one.

You are a developer who has shipped plenty of code to production servers. You know the feeling of promoting a build from staging: the checklist, the slightly elevated heart rate, the double-check that you are pointed at the right environment. Mainnet-beta is that same feeling, with one twist. On a Web2 server a bad deploy costs you a rollback and an apology. On Solana, the deploy itself costs SOL, and that SOL is rent locking your bytecode on-chain. So the goal today is not just “make it work.” It is to deploy intentionally, confirm what you deployed, and know exactly how much it cost and why.

Mainnet-beta is the production Solana cluster you first met back when you compared it against devnet. Everything you have done since then was rehearsal for landing a program here.

### Steps
1. Build a fresh release artifact. Run anchor build so target/deploy/ holds the current .so file and the program keypair. Never deploy a stale build to mainnet; rebuild so the bytecode you ship is exactly the code you just reviewed.

2. Sync your program ID. Run anchor keys sync. This makes the declare_id! in your program match the actual keypair in target/deploy/vault-keypair.json. If anchor keys sync changes anything, run anchor build once more so the embedded ID and the artifact agree. A mismatch here is the single most common first-deploy failure.

3. Measure the rent before you spend it. The bulk of your deploy cost is rent that keeps the program account rent-exempt, and it scales with the byte size of your .so. Preview it with the command in “Run it” below. This number, plus a small margin for transaction fees, is what your wallet must hold.

4. Point the Solana CLI at mainnet and check your wallet. Run solana config set --url mainnet-beta, then solana balance. Confirm the balance comfortably exceeds the rent figure from the previous step. There is no solana airdrop on mainnet; if you are short, fund the wallet now.

5. Tell Anchor to use mainnet. In Anchor.toml, set the provider block so deploys target mainnet and use your funded keypair:

>[provider]
>cluster = "Mainnet"
>wallet = "~/.config/solana/id.json"

Point wallet at the keypair that actually holds your SOL. Whatever keypair signs this deploy becomes the program’s upgrade authority, so choose deliberately.

6. Deploy with a priority fee. Mainnet is busy, and a deploy is many transactions in a row. Adding a compute-unit price makes each one far more likely to land before its blockhash expires. Use the deploy command in “Run it” below.

7. Confirm what landed. Run solana program show [your-program-id] and read it back: the program ID, the upgrade authority, the data length, and the balance. Then open the same address on Solana Explorer with the cluster set to Mainnet and confirm your program appears as an upgradeable program.

### Run it
First, rehearse on devnet, where SOL is free. This is your staging deploy: it proves the artifact deploys cleanly before you spend real money, and it leaves a devnet copy of the program that Days 86 and 87 build on.

One thing to get right before you deploy anywhere: a deploy is dozens of write transactions in a row, and the free public RPC (api.devnet.solana.com, and its mainnet equivalent) is rate-limited enough that those writes expire before they land — the Blockhash expired ... Max retries exceeded failure. Real deploys always go through a dedicated RPC. Grab a free devnet+mainnet endpoint from Helius or QuickNode, then deploy through it with a priority fee and --use-rpc (which routes the writes over the RPC instead of the validator’s TPU). Always wrap the endpoint URL in quotes — the ? and & in it are shell glob characters, and an unquoted URL fails with zsh: no matches found:

>solana airdrop 2 --url devnet          # top up devnet SOL if the balance is low
>anchor program deploy \
>  --provider.cluster "https://devnet.helius-rpc.com/?api-key=YOUR_KEY" \
>  -- --with-compute-unit-price 50000 --use-rpc
>solana program show [your-program-id] --url devnet

If a deploy still stalls, do not re-run from scratch — resume the buffer (see “If a deploy stalls partway” below) so you are not leaking SOL on each attempt.

That devnet deployment is enough to complete today’s challenge. If you have real SOL and want the full production experience (recommended, but optional), promote the same build to mainnet through your dedicated mainnet endpoint. Preview the rent your program account will need first (run from your project root):

>solana rent $(wc -c < target/deploy/vault.so)

Deploy to mainnet with a priority fee, through your dedicated mainnet endpoint (put the same URL in Anchor.toml’s cluster, or pass it on the command line):

>anchor program deploy \
>  --provider.cluster "https://mainnet.helius-rpc.com/?api-key=YOUR_KEY" \
>  -- --with-compute-unit-price 10000 --use-rpc

Anything after the -- is passed straight through to the underlying solana program deploy. If you prefer to call the Solana CLI directly instead, the equivalent is:

>solana program deploy ./target/deploy/vault.so \
>  --program-id ./target/deploy/vault-keypair.json \
>  --url "https://mainnet.helius-rpc.com/?api-key=YOUR_KEY" \
>  --with-compute-unit-price 10000 --use-rpc

These commands use vault because that is your program’s name (the anchor init vault crate); if you named yours differently, swap vault for it. The 10000 is micro-lamports per compute unit; raise it if you see repeated retries during congestion.

If a deploy stalls partway
Large programs upload through a temporary buffer account, and a mainnet deploy is not atomic. If you see an error like “write transactions failed” before it finishes, the SOL you spent is not lost; it is sitting in a buffer. List orphaned buffers and reclaim or resume them like this:

See what is stranded: solana program show --buffers
Resume the deploy into an existing buffer instead of starting over: solana program deploy ./target/deploy/vault.so --buffer [BUFFER_KEYPAIR] (the deploy command prints a recovery seed phrase when it fails; keep it so you can rebuild the buffer keypair).
Give up on a buffer and recover its rent: solana program close [BUFFER_ADDRESS]
The full recovery walkthrough is in the official Deploying Programs guide. Reading it once before you deploy is cheaper than reading it for the first time mid-failure.

You promoted code from a forgiving environment to a permanent one, and the only real difference from your devnet deploys was the weight behind each step. The compiled bytecode that anchor build produced is now stored in an on-chain program account, rent-exempt because you funded it past the threshold that solana rent showed you. The program ID is no longer a throwaway devnet address; it is a stable public identifier that wallets, frontends, and other programs can call. That is exactly what a production deploy is supposed to give you: a fixed address backed by code you can point to.

You also met the one piece of mainnet that has no devnet equivalent: real economic finality on the deploy itself. Every lamport you spent went somewhere specific, rent into the program account, fees and priority into the validators that included your transactions, and you can read every bit of that back with solana program show. If you have ever promoted a service to production and then immediately checked the health endpoint to make sure it was really up, that final confirmation step is the same instinct, and it is just as worth doing here.

One thing to sit with before tomorrow: the wallet that signed this deploy is now your program’s upgrade authority. Right now that means you, and you alone, can ship a new version to this same address. That is a powerful default and also a responsibility. Tomorrow’s challenge is entirely about deciding what to do with that authority and locking it down deliberately, so leave it exactly as it is for now.

