import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { AnchorProvider, BN, Program, Wallet, web3 } from "@anchor-lang/core";

const { Connection, Keypair, PublicKey, LAMPORTS_PER_SOL } = web3;
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// Load the IDL relative to this file, not the working directory
const idl = JSON.parse(
  fs.readFileSync(new URL("./idl.json", import.meta.url), "utf8")
);

// Load the server's signing wallet from an absolute path
const secret = JSON.parse(
  fs.readFileSync(path.join(os.homedir(), ".config/solana/id.json"), "utf8")
);
const keypair = Keypair.fromSecretKey(new Uint8Array(secret));

const connection = new Connection("https://api.devnet.solana.com", "confirmed");
const provider = new AnchorProvider(connection, new Wallet(keypair), {
  commitment: "confirmed",
});

// Cast to `any`: JSON.parse loses the literal IDL shape at compile time,
// so TypeScript can't see that a "Vault" account exists. It does exist —
// confirmed in idl.json's accounts array — this just restores runtime access.
const program = new Program(idl, provider) as any;

// The vault PDA is derived from the "vault" seed and the wallet's key (Arc 13)
const [vaultPda] = PublicKey.findProgramAddressSync(
  [Buffer.from("vault"), keypair.publicKey.toBuffer()],
  program.programId
);

const server = new McpServer({
  name: "my-solana-program",
  version: "1.0.0",
});

server.registerTool(
  "get_wallet_balance",
  {
    title: "Get wallet balance",
    description:
      "Get the devnet SOL balance of the wallet this server signs with.",
  },
  async () => {
    const lamports = await connection.getBalance(keypair.publicKey);
    return {
      content: [{
        type: "text",
        text: `${keypair.publicKey.toBase58()} holds ${lamports / LAMPORTS_PER_SOL} SOL (${lamports} lamports)`,
      }],
    };
  }
);

server.registerTool(
  "get_vault",
  {
    title: "Read vault state",
    description:
      "Fetch the current on-chain state (authority and balance) of the vault account from devnet.",
  },
  async () => {
    let state;
    try {
      state = await program.account.vault.fetch(vaultPda);
    } catch {
      // The vault PDA is created lazily on the first deposit; it may not exist yet.
      return {
        content: [{
          type: "text",
          text: `No vault exists yet at ${vaultPda.toBase58()}. Call initialize_vault first.`,
        }],
      };
    }
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          address: vaultPda.toBase58(),
          authority: state.authority.toBase58(),
          balance: state.balance.toString(),
        }),
      }],
    };
  }
);

server.registerTool(
  "initialize_vault",
  {
    title: "Initialize the vault",
    description:
      "Create and fund the vault account on devnet with a one-time deposit, signed by the server's wallet. Does nothing if the vault already exists.",
    inputSchema: {
      amountSol: z.number().positive()
        .describe("SOL to deposit when first creating the vault"),
    },
  },
  async ({ amountSol }) => {
    // Policy guardrails: enforced in code, not in the prompt
    if (!connection.rpcEndpoint.includes("devnet")) {
      return {
        content: [{ type: "text", text: "Refused: this server only signs on devnet." }],
        isError: true,
      };
    }
    const MAX_SOL = 0.1;
    if (amountSol > MAX_SOL) {
      return {
        content: [{ type: "text", text: `Refused: at most ${MAX_SOL} SOL per deposit.` }],
        isError: true,
      };
    }

    // Only write if the vault has not been initialized before.
    try {
      const existing = await program.account.vault.fetch(vaultPda);
      return {
        content: [{
          type: "text",
          text: `Vault already initialized at ${vaultPda.toBase58()} with balance ${existing.balance.toString()}. No deposit sent.`,
        }],
      };
    } catch {
      // Vault does not exist yet — fall through and create it.
    }

    const lamports = Math.round(amountSol * LAMPORTS_PER_SOL);
    const sig = await program.methods
      .deposit(new BN(lamports))
      .accounts({ authority: keypair.publicKey })
      .rpc();
    const created = await program.account.vault.fetch(vaultPda);
    return {
      content: [{
        type: "text",
        text: `Initialized vault ${vaultPda.toBase58()} with balance ${created.balance.toString()} (signature ${sig})`,
      }],
    };
  }
);


async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Solana MCP server running on stdio");
}

main().catch((err) => {
  console.error("Server error:", err);
  process.exit(1);
});
