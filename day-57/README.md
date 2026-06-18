## Install Anchor and scaffold your first program

Close out of every Token-2022 script in your editor. For seven weeks you have been the one calling programs: minting, transferring, freezing, harvesting. The System Program signed off your transfers. The Token-2022 program enforced your fees. You were the client.

That ends today. Web2 made you fluent in deploying serverless functions to someone else’s runtime: write a handler, push it up, hit the endpoint, watch the logs. A Solana program is the same shape. It is code that lives at an address, gets invoked by clients, runs in a shared runtime, and writes results back to a database (the accounts model you already know). The runtime is the Solana Virtual Machine instead of AWS Lambda, and the language is Rust instead of TypeScript, but the mental model carries over cleanly.

Anchor is the framework that makes that translation comfortable. It hides the byte-level account serialization, generates a typed client for you, and gives you a project layout that feels closer to a standard Rust workspace than to raw Solana boilerplate. Today you install it and let it scaffold your first program. You will not write a single line of business logic. You will earn the right to do that tomorrow by getting the toolchain green first.

### Steps
#### Step 1: Confirm the prerequisites are present. If any of these print an error, fix that one first before continuing.
>solana --version
>rustc --version
>cargo --version
>node --version

#### Step 2: Install the Anchor Version Manager (AVM). AVM is to Anchor what nvm is to Node: it lets you install multiple Anchor CLI versions side by side and switch between them per project. You always want this instead of installing a single fixed Anchor binary, because real Solana projects pin specific Anchor versions in Anchor.toml.
>cargo install --git https://github.com/solana-foundation/anchor avm --force

#### Step 3: Use AVM to install the latest stable Anchor CLI and select it as your active version.
>avm install latest
>avm use latest
>anchor --version

You should see a version line like anchor-cli 1.0.x. The exact patch number does not matter for this challenge, only that the command answers.


#### Step 4: Move into a parent folder where you keep your Solana work (not inside any existing project), then scaffold a brand new Anchor project.
>anchor init counter
>cd counter

This creates a fresh directory with a complete, buildable Anchor workspace inside it.

#### Step 5: Take a tour of what just appeared. Open the project in your editor and look at each of these:
- Anchor.toml: the project configuration. Notice the [programs.localnet] section, which maps your program’s name to a public key. That key is the on-chain address your program will deploy to.
- Cargo.toml at the workspace root: a standard Rust workspace file that lists programs/* as members.
- programs/counter/src/lib.rs: the actual program. Pay attention to three things:
-   declare_id!(...): the same address you saw in Anchor.toml, baked into the binary.
-   #[program]: the module that contains every instruction handler. Anchor expands this macro into the dispatcher that routes incoming transactions to your functions.
-   pub fn initialize(_ctx: Context<Initialize>) -> Result<()>: a single no-op instruction. The Context wraps the accounts the instruction receives.
- programs/counter/tests/test_initialize.rs: a scaffolded Rust integration test that loads your compiled program into LiteSVM and calls the no-op initialize instruction. You will not run it today, and tomorrow you will replace it with your own test.
- package.json: the JavaScript dependencies for Anchor’s client tooling.

#### Step 4: Compile the scaffolded program. This is the moment of truth for your toolchain.
Run it
>anchor build

The first build takes a while because Anchor pulls down and compiles the Solana program SDK. Subsequent builds are seconds. When it finishes, you should see a fresh target/ directory containing a .so file (the compiled program) and an idl/ folder containing a JSON file (the Interface Definition Language description of your program). Both are the artifacts you will use for the rest of this arc.

