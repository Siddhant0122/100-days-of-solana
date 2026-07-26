import { readFileSync } from "node:fs";
import { GoogleGenAI } from "@google/genai";
import { web3 } from "@anchor-lang/core";

const {
  Connection, Keypair, PublicKey, SystemProgram,
  Transaction, sendAndConfirmTransaction, LAMPORTS_PER_SOL,
} = web3;

const connection = new Connection("https://api.devnet.solana.com", "confirmed");
const wallet = Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(readFileSync("agent-wallet.json", "utf8")))
);

// Enforced in code. The model cannot override this, no matter what it is asked.
const MAX_SOL_PER_SEND = 0.1;

const tools = [
  {
    type: "function",
    name: "get_balance",
    description: "Get the current balance of the agent's own devnet wallet, in SOL.",
    parameters: { type: "object", properties: {} },
  },
  {
    type: "function",
    name: "send_sol",
    description:
      `Send SOL from the agent's wallet to a recipient on devnet. ` +
      `Transfers above ${MAX_SOL_PER_SEND} SOL are rejected by policy.`,
    parameters: {
      type: "object",
      properties: {
        recipient: { type: "string", description: "Base58 Solana address to send to" },
        amount_sol: { type: "number", description: "Amount to send, in SOL" },
      },
      required: ["recipient", "amount_sol"],
    },
  },
];

async function runTool(name, input) {
  if (name === "get_balance") {
    const lamports = await connection.getBalance(wallet.publicKey);
    return { balance_sol: lamports / LAMPORTS_PER_SOL };
  }
  if (name === "send_sol") {
    if (input.amount_sol > MAX_SOL_PER_SEND) {
      return {
        error: `Rejected by policy: ${input.amount_sol} SOL exceeds the ` +
               `${MAX_SOL_PER_SEND} SOL per-transfer cap.`,
      };
    }
    let recipient;
    try {
      recipient = new PublicKey(input.recipient);
    } catch {
      return { error: `"${input.recipient}" is not a valid Solana address.` };
    }
    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: wallet.publicKey,
        toPubkey: recipient,
        lamports: Math.round(input.amount_sol * LAMPORTS_PER_SOL),
      })
    );
    let signature;
    try {
      signature = await sendAndConfirmTransaction(connection, transaction, [wallet]);
    } catch (error) {
      const message = error?.message ?? String(error);
      if (/no record of a prior credit|insufficient/i.test(message)) {
        return {
          error: `Send failed: the agent wallet ${wallet.publicKey.toBase58()} has no ` +
                 `devnet SOL. Fund it at https://faucet.solana.com/ and try again.`,
        };
      }
      return { error: `Send failed: ${message}` };
    }
    return {
      signature,
      explorer: `https://explorer.solana.com/tx/${signature}?cluster=devnet`,
    };
  }
  return { error: `Unknown tool: ${name}` };
}

const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

let history = [
  {
    type: "user_input",
    content: [{ type: "text", text: process.argv[2] }],
  },
];

while (true) {
  const interaction = await client.interactions.create({
    model: "gemini-3.6-flash",
    store: false,
    input: history,
    tools,
    system_instruction:
      "You are an agent that manages a small Solana devnet wallet. " +
      "You can check its balance and send SOL. Always report transaction " +
      "signatures and policy rejections back to the user honestly.",
  });

  history.push(...interaction.steps);

  const functionCalls = interaction.steps.filter((s) => s.type === "function_call");

  if (functionCalls.length === 0) {
    console.log("\nAgent:", interaction.output_text);
    break;
  }

  for (const fc of functionCalls) {
    console.log("Tool call:", fc.name, JSON.stringify(fc.arguments));
    const result = await runTool(fc.name, fc.arguments);
    console.log("Result:  ", JSON.stringify(result));
    history.push({
      type: "function_result",
      name: fc.name,
      call_id: fc.id,
      result: [{ type: "text", text: JSON.stringify(result) }],
    });
  }
}

