## Build your capstone and ship it to devnet

Today you ship. Not a checkpoint, not a guided tour of someone else’s design: a project that is yours, assembled from everything you have learned since Day 1, deployed to devnet where anyone on the internet can look it up. Ninety-eight days of challenges have each handed you one piece at a time. A program with PDA state. Constraints that reject bad input. Tests that prove both the happy path and the failure path. A deploy pipeline. A frontend. An agent. The capstone is the day those stop being separate exercises and become one thing with your name on it.

Every engineering team has a moment when the feature branches stop mattering and someone asks the only question that counts: does the whole thing work, end to end, in an environment other people can reach? That is a shipping day, and shipping days have a different energy than building days. You are not learning a new API today. You are making decisions: what to include, what to cut, what “done” means for a one-day build. Those are the same decisions you will make on every real project after this one.

Nothing in today’s challenge is new. That is the point. Every command, every macro, every test pattern below is something you have already used somewhere in the last fourteen arcs. What is new is that nobody is handing you the design.

Design, build, test, and deploy a capstone project to devnet, then connect it to at least one other piece of your 100-days toolkit. If you already have a project idea burning a hole in your pocket, build that. If you would rather have rails for the day, follow the reference build below: a program called proof-of-ship that lets any wallet permanently record, on chain, that it shipped a capstone.

### Steps
1. Choose your capstone and hold it to the spec. Whether you build your own idea or the reference project, your capstone must check every box:

- An Anchor program with at least one PDA account whose seeds you designed
- At least one constraint or custom error that rejects invalid input
- A passing happy-path test and a passing failure-path test
- Deployed to devnet and visible in Solana Explorer
- Connected to at least one other artifact from your 100 days (step 6)

Keep the scope honest: one instruction done well beats four instructions half-finished at midnight. The steps below build the reference project; if you are building your own idea, follow the same sequence and substitute your own names and logic.

2. Scaffold the project. Just like every program day since Arc 9, initialize the project and clear out the scaffold pieces you will replace:

>anchor init proof-of-ship
>cd proof-of-ship
>rm -rf programs/proof-of-ship/tests
>rm -rf programs/proof-of-ship/src/instructions
>rm -f programs/proof-of-ship/src/state.rs programs/proof-of-ship/src/constants.rs programs/proof-of-ship/src/error.rs programs/proof-of-ship/src/instructions.rs
>mkdir tests

Set up the TypeScript test harness. Open Anchor.toml and change the [scripts] test entry (the default cargo test silently skips TypeScript tests):

>[scripts]
>test = "yarn run ts-mocha -p ./tsconfig.json -t 1000000 tests/**/*.ts"

Add the TypeScript client. anchor init already scaffolded typescript, ts-mocha, mocha, and chai pinned to the v4 line (v6 is ESM-only and breaks the test runner), so only add what’s missing: ts-node, which ts-mocha requires at runtime but doesn’t install for you, and @types/node. Don’t re-add typescript here: doing so pulls the unpinned latest tag, which as of mid-2026 is the TypeScript 7 native rewrite and is not yet compatible with ts-node.

>yarn add @anchor-lang/core
>yarn add --dev ts-node @types/node

Create tsconfig.json in the project root:

>{
>  "compilerOptions": {
>    "types": ["mocha", "chai", "node"],
>    "typeRoots": ["./node_modules/@types"],
>    "lib": ["es2020"],
>    "module": "commonjs",
>    "target": "es2020",
>    "esModuleInterop": true,
>    "resolveJsonModule": true
>  }
>}

3. Write the program. Replace the entire contents of programs/proof-of-ship/src/lib.rs:

>use anchor_lang::prelude::*;
>
>declare_id!("11111111111111111111111111111111");
>
>#[program]
>pub mod proof_of_ship {
>    use super::*;
>
>    pub fn ship(ctx: Context<Ship>, project_name: String, message: String) -> Result<()> {
>        require!(project_name.len() <= 64, CapstoneError::NameTooLong);
>        require!(message.len() <= 256, CapstoneError::MessageTooLong);
>
>        let record = &mut ctx.accounts.ship_record;
>        record.builder = ctx.accounts.builder.key();
>        record.project_name = project_name;
>        record.message = message;
>        // Clock is Solana's built-in clock sysvar; this reads the current Unix timestamp
>        record.shipped_at = Clock::get()?.unix_timestamp;
>        record.bump = ctx.bumps.ship_record;
>        Ok(())
>    }
>}
>
>#[derive(Accounts)]
>pub struct Ship<'info> {
>    #[account(
>        init,
>        payer = builder,
>        space = 8 + ShipRecord::INIT_SPACE,
>        seeds = [b"ship", builder.key().as_ref()],
>        bump
>    )]
>    pub ship_record: Account<'info, ShipRecord>,
>    #[account(mut)]
>    pub builder: Signer<'info>,
>    pub system_program: Program<'info, System>,
>}
>
>#[account]
>#[derive(InitSpace)]
>pub struct ShipRecord {
>    pub builder: Pubkey,
>    #[max_len(64)]
>    pub project_name: String,
>    #[max_len(256)]
>    pub message: String,
>    pub shipped_at: i64,
>    pub bump: u8,
>}
>
>#[error_code]
>pub enum CapstoneError {
>    #[msg("Project name must be 64 characters or fewer")]
>    NameTooLong,
>    #[msg("Message must be 256 characters or fewer")]
>    MessageTooLong,
>}

Notice the design decision hiding in the seeds: [b"ship", builder.key().as_ref()] means each wallet gets exactly one record, forever. The address is the constraint. Now sync the program ID: anchor init already generated a program keypair when it scaffolded the project, but the placeholder declare_id! above doesn’t match it. anchor keys sync rewrites declare_id! to the real keypair’s address, then the build bakes that real ID into the compiled program:

>anchor keys sync
>anchor build

4. Prove it works, both directions. Create tests/proof-of-ship.ts:

>import * as anchor from "@anchor-lang/core";
>import { assert } from "chai";
>
>describe("proof-of-ship", () => {
>  const provider = anchor.AnchorProvider.env();
>  anchor.setProvider(provider);
>  const program = anchor.workspace.ProofOfShip;
>
>  it("records your capstone on chain", async () => {
>    await program.methods
>      .ship("Proof of Ship", "Built in public, 100 days straight.")
>      .rpc();
>
>    const [recordPda] = anchor.web3.PublicKey.findProgramAddressSync(
>      [Buffer.from("ship"), provider.wallet.publicKey.toBuffer()],
>      program.programId
>    );
>    const record = await program.account.shipRecord.fetch(recordPda);
>
>    assert.equal(record.projectName, "Proof of Ship");
>    assert.equal(
>      record.builder.toBase58(),
>      provider.wallet.publicKey.toBase58()
>    );
>  });
>
>  it("only lets each wallet ship once", async () => {
>    let rejected = false;
>    try {
>      await program.methods.ship("Second try", "This should never land").rpc();
>    } catch (_err) {
>      rejected = true;
>    }
>    assert.isTrue(rejected, "second ship should have been rejected");
>  });
>});

The failure-path test earns its keep here: it proves the one-record-per-wallet rule is enforced by the runtime, not just implied by your intentions. The second call fails because the PDA account already exists, so init refuses to create it again.

5. Ship it. Run the tests locally, then deploy to devnet and confirm the program is live. Deploy through a dedicated RPC (the free Helius or QuickNode endpoint from Day 85), not the public devnet URL — a program deploy is many transactions in a row, and the public RPC drops them with Blockhash expired, exactly as you saw in Arc 13. Quote the endpoint URL, since the ? in it is a shell glob character:

>anchor test
>solana balance --url devnet
>anchor program deploy \
>  --provider.cluster "[your-devnet-endpoint]" \
>  -- --with-compute-unit-price 50000 --use-rpc
>anchor keys list
>solana program show [YOUR_PROGRAM_ID] --url devnet

6. Make it yours. Pick at least one integration from your existing work; each one is a skill you already have, pointed at today’s program:

- Frontend: add a page to your Arc 13 React app that fetches and displays your ShipRecord, so anyone with a browser can read your shipped message.
- Agent: give your Arc 14 agent a read-only tool that fetches the record and reports whether a given wallet has shipped.
- Token: using your Arc 7 skills, mint yourself a 1-of-1 Token-2022 badge whose metadata names your capstone and program ID, a commemorative asset in the same wallet that deployed the program.

### Run it
>anchor test && anchor program deploy --provider.cluster "[your-devnet-endpoint]" -- --with-compute-unit-price 50000 --use-rpc

You made the jump from completing challenges to shipping software. The program you deployed today is small, but the shape of the day was the real lesson: you scoped a project, designed state around a PDA whose seeds encode a business rule, wrote tests that attack your own assumptions, deployed to a public cluster, and wired the result into a larger system. That sequence, scope, build, verify, ship, integrate, is the job. It is what you would do in week one at any team building on Solana, and it is what you did today without a script telling you which file to open next.

It is also worth pausing on what your capstone record actually is. On Day 1 an account was an abstract idea you were taking on faith. Today you designed one, calculated its size, chose its address, paid its rent, and populated it with a message that will outlive this challenge. The mental model you started with, accounts as database rows, carried you all the way here; the difference is that now you are the one designing the schema, and the database is a global network that nobody can take down or quietly edit your row in.

