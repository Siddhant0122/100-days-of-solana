## Wrap your Solana program in an MCP server

The tools you built this week have a limitation you may have already noticed: they are trapped inside one script. The balance checker from Day 92 and the guarded transfer tool from Day 93 only exist inside your own agent loop. If a teammate wants an AI assistant that can read your program’s state, they have to copy your code, and if you improve a tool, every copy goes stale. Web2 solved this exact problem years ago with API specifications: describe your endpoints once, and any client can consume them. Today you will do the same thing for AI agents.

The standard is called the Model Context Protocol (MCP), an open protocol that lets you package tools into a small server that any MCP-compatible client can connect to: Claude Code, Claude Desktop, Cursor, and a growing list of others. Instead of writing the agent loop yourself like you did on Day 93, you write only the tools, and the client handles the model, the conversation, and the loop. By the end of today, the Anchor program you deployed in Arc 13 will have its own MCP server, and you will watch an AI client discover your tools and call your program without you writing a single line of agent code.

Your guarded payout agent demo went well. Too well, actually. Now three different teammates want agent access to your program: one uses Claude Desktop, one lives in Claude Code all day, and one is building an internal support bot. Your first instinct is Web2 muscle memory, and it is the right instinct: you would never hand three consumers three copies of the same integration code. You would publish one API and let each client connect to it. MCP is that layer for agents. You will wrap your program’s reads and writes, guardrails included, into one server that all three of them can plug in with a single command.

You will build an MCP server in TypeScript that exposes three tools backed by your deployed program on devnet: a wallet balance check, a read of your program’s state account, and a guarded write that sends a real transaction. Then you will connect it to an MCP client and talk to your program in plain English. This walkthrough uses your vault program from Arc 13 — a Vault account (an authority and a balance) and a deposit instruction — as the running example; if your program differs, substitute its account names, seeds, and instructions wherever they appear.

### Steps
1. Create a fresh project and install the dependencies: the official MCP TypeScript SDK, zod for describing tool inputs, and the Anchor client you already know from Arc 13.
>mkdir solana-mcp-server && cd solana-mcp-server
>npm init -y
>npm install @modelcontextprotocol/sdk@^1.29 @anchor-lang/core@1.1.2 zod@^3.25
>npm install -D typescript tsx @types/node

2. Copy your program’s IDL into the project. The IDL is the same machine-readable description of your program that powered your typed client in Arc 13, and it is about to power your MCP tools too.
>cp /path/to/your-anchor-project/target/idl/vault.json ./idl.json

3. Create server.ts and set up the Solana side first. One important habit for MCP servers: the client launches your server from an arbitrary working directory, so load files relative to the script (via import.meta.url) or from absolute paths, never from the current directory.

>import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
>import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
>import { z } from "zod";
>import { AnchorProvider, BN, Program, Wallet, web3 } from "@anchor-lang/core";
>
>const { Connection, Keypair, PublicKey, LAMPORTS_PER_SOL } = web3;
>import fs from "node:fs";
>import os from "node:os";
>import path from "node:path";
>
>// Load the IDL relative to this file, not the working directory
>const idl = JSON.parse(
>  fs.readFileSync(new URL("./idl.json", import.meta.url), "utf8")
>);
>
>// Load the server's signing wallet from an absolute path
>const secret = JSON.parse(
>  fs.readFileSync(path.join(os.homedir(), ".config/solana/id.json"), "utf8")
>);
>const keypair = Keypair.fromSecretKey(new Uint8Array(secret));
>
>const connection = new Connection("https://api.devnet.solana.com", "confirmed");
>const provider = new AnchorProvider(connection, new Wallet(keypair), {
>  commitment: "confirmed",
>});
>const program = new Program(idl, provider);
>
>// The vault PDA is derived from the "vault" seed and the wallet's key (Arc 13)
>const [vaultPda] = PublicKey.findProgramAddressSync(
>  [Buffer.from("vault"), keypair.publicKey.toBuffer()],
>  program.programId
>);

4. Now create the server and register your first two tools, both read-only. Each tool gets a name, a description the model reads to decide when to call it, and a handler that returns text content. Notice that you are not writing any prompt logic or any loop: just the tool itself.
>const server = new McpServer({
>  name: "my-solana-program",
>  version: "1.0.0",
>});
>
>server.registerTool(
>  "get_wallet_balance",
>  {
>    title: "Get wallet balance",
>    description:
>      "Get the devnet SOL balance of the wallet this server signs with.",
>  },
>  async () => {
>    const lamports = await connection.getBalance(keypair.publicKey);
>    return {
>      content: [{
>        type: "text",
>        text: `${keypair.publicKey.toBase58()} holds ${lamports / LAMPORTS_PER_SOL} SOL (${lamports} lamports)`,
>      }],
>    };
>  }
>);
>
>server.registerTool(
>  "get_vault",
>  {
>    title: "Read vault state",
>    description:
>      "Fetch the current on-chain state (authority and balance) of the vault account from devnet.",
>  },
>  async () => {
>    let state;
>    try {
>      state = await program.account.vault.fetch(vaultPda);
>    } catch {
>      // The vault PDA is created lazily on the first deposit; it may not exist yet.
>      return {
>        content: [{
>          type: "text",
>          text: `No vault exists yet at ${vaultPda.toBase58()}. Call initialize_vault first.`,
>        }],
>      };
>    }
>    return {
>      content: [{
>        type: "text",
>        text: JSON.stringify({
>          address: vaultPda.toBase58(),
>          authority: state.authority.toBase58(),
>          balance: state.balance.toString(),
>        }),
>      }],
>    };
>  }
>);

5. Add the write tool. This is where Day 93’s lesson travels with you: the guardrails live in the server’s code, so every client that ever connects inherits them automatically. No prompt can talk its way past an if statement. This tool refuses to sign on anything other than devnet and caps the work per call.
>server.registerTool(
>  "initialize_vault",
>  {
>    title: "Initialize the vault",
>    description:
>      "Create and fund the vault account on devnet with a one-time deposit, signed by the server's wallet. Does nothing if the vault already exists.",
>    inputSchema: {
>      amountSol: z.number().positive()
>        .describe("SOL to deposit when first creating the vault"),
>    },
>  },
>  async ({ amountSol }) => {
>    // Policy guardrails: enforced in code, not in the prompt
>    if (!connection.rpcEndpoint.includes("devnet")) {
>      return {
>        content: [{ type: "text", text: "Refused: this server only signs on devnet." }],
>        isError: true,
>      };
>    }
>    const MAX_SOL = 0.1;
>    if (amountSol > MAX_SOL) {
>      return {
>        content: [{ type: "text", text: `Refused: at most ${MAX_SOL} SOL per deposit.` }],
>        isError: true,
>      };
>    }
>
>    // Only write if the vault has not been initialized before.
>    try {
>      const existing = await program.account.vault.fetch(vaultPda);
>      return {
>        content: [{
>          type: "text",
>          text: `Vault already initialized at ${vaultPda.toBase58()} with balance ${existing.balance.toString()}. No deposit sent.`,
>        }],
>      };
>    } catch {
>      // Vault does not exist yet — fall through and create it.
>    }
>
>    const lamports = Math.round(amountSol * LAMPORTS_PER_SOL);
>    const sig = await program.methods
>      .deposit(new BN(lamports))
>      .accounts({ authority: keypair.publicKey })
>      .rpc();
>    const created = await program.account.vault.fetch(vaultPda);
>    return {
>      content: [{
>        type: "text",
>        text: `Initialized vault ${vaultPda.toBase58()} with balance ${created.balance.toString()} (signature ${sig})`,
>      }],
>    };
>  }
>);

The .accounts() call only needs the accounts Anchor cannot resolve on its own; the vault PDA and the System Program are resolved automatically from the IDL seeds. Adjust the instruction and account names to match your program.

6. Wire up the transport at the bottom of the file. MCP servers speak JSON-RPC over stdio, which means stdout belongs to the protocol. If you print anything with console.log, you will corrupt the message stream and the client will disconnect. Use console.error for any logging, since stderr is left alone.
>async function main() {
>  const transport = new StdioServerTransport();
>  await server.connect(transport);
>  console.error("Solana MCP server running on stdio");
>}
>
>main().catch((err) => {
>  console.error("Server error:", err);
>  process.exit(1);
>});

7. Test it before connecting a real client. The MCP Inspector is a browser-based test harness that launches your server, lists its tools, and lets you call them by hand, much like Postman for a Web2 API. Run it, open the URL it prints, click Connect, then List Tools, and try get_vault and initialize_vault from the UI.

8. Now register the server with Claude Code and talk to your program. This step needs the Claude Code CLI, which is separate from the editor extension — if claude is not found, install it with the official installer: curl -fsSL https://claude.ai/install.sh | bash (do not use sudo npm install -g, which the docs warn against and which fails with a permissions error on macOS). It requires a Claude Pro, Max, Team, Enterprise, or Console account. After adding the server, start claude, type /mcp to confirm the server is connected, then ask in plain English: “Read my vault. If it does not exist, initialize it with 0.05 SOL, then show me its balance.” Watch the client discover your tools, call them in the right order, and report back. For a satisfying finale, ask it to deposit 5 SOL and watch your guardrail refuse.

### Run it
>Test the server by hand in the Inspector UI
>npx @modelcontextprotocol/inspector npx tsx server.ts
>
>Install the Claude Code CLI first if `claude` is not found (official recommended method)
>curl -fsSL https://claude.ai/install.sh | bash
>
>Register it with Claude Code (stdio is the default transport)
>claude mcp add my-solana-program -- npx tsx "$(pwd)/server.ts"
>
>Start a session and ask about your program in plain English
>claude

You published an API for AI agents. On Day 93 you wrote the tools and the loop that used them; today you kept only the tools and handed the loop to a standard protocol. Your MCP server describes each tool with a name, a description, and a typed input schema, and any MCP client can now discover that catalog at connection time and decide when to call what. This is the same architectural move that made Web2 APIs powerful: separating the capability (your server) from the consumer (whichever client connects), so one integration serves every client that speaks the protocol.

Notice where the trust boundary sits. The model never touched your keypair, your RPC connection, or your program client; it only ever sent tool calls, and your code decided whether to honor them. The devnet check and the per-call cap ran inside the server process, which means the teammate on Claude Desktop and the teammate building a support bot get exactly the same rules you do, with no way to prompt around them. Tomorrow you will push harder on that idea and treat signing policy as a first-class design problem, because “what is this agent allowed to sign” is the question that separates a demo from something you would run with real value behind it.