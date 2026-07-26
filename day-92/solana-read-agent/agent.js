import { GoogleGenAI } from "@google/genai";
import { web3 } from "@anchor-lang/core";

const { Connection, PublicKey, LAMPORTS_PER_SOL } = web3;

const connection = new Connection("https://api.devnet.solana.com", "confirmed");

const tools = [
  {
    type: "function",
    name: "get_balance",
    description:
      "Get the current SOL balance of a Solana account on devnet. " +
      "Returns the balance in both lamports and SOL.",
    parameters: {
      type: "object",
      properties: {
        address: { type: "string", description: "The base58-encoded Solana address to check" },
      },
      required: ["address"],
    },
  },
  {
    type: "function",
    name: "get_account_info",
    description:
      "Fetch metadata for a Solana account on devnet: which program owns it, " +
      "its lamport balance, whether it is executable, and how many bytes of data it stores.",
    parameters: {
      type: "object",
      properties: {
        address: { type: "string", description: "The base58-encoded Solana address to inspect" },
      },
      required: ["address"],
    },
  },
];

async function runTool(name, input) {
  try {
    const pubkey = new PublicKey(input.address);
    if (name === "get_balance") {
      const lamports = await connection.getBalance(pubkey);
      return JSON.stringify({ lamports, sol: lamports / LAMPORTS_PER_SOL });
    }
    if (name === "get_account_info") {
      const info = await connection.getAccountInfo(pubkey);
      if (!info) return JSON.stringify({ exists: false });
      return JSON.stringify({
        exists: true,
        owner: info.owner.toBase58(),
        lamports: info.lamports,
        executable: info.executable,
        dataLength: info.data.length,
      });
    }
    return JSON.stringify({ error: `Unknown tool: ${name}` });
  } catch (err) {
    return JSON.stringify({ error: `Tool error: ${err.message}` });
  }
}

// --- Agent loop ---
const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const question =
  process.argv.slice(2).join(" ") ||
  "What is the SOL balance of YOUR_WALLET_ADDRESS_HERE?";

let history = [
  {
    type: "user_input",
    content: [{ type: "text", text: question }],
  },
];

while (true) {

  const interaction = await client.interactions.create({
    model: "gemini-3.6-flash",
    store: false,
    input: history,
    tools,
    system_instruction:
      "You are a Solana devnet assistant. Use your tools to look up live " +
      "on-chain state before answering. Report balances in both lamports and SOL.",
  });

  history.push(...interaction.steps);

  const functionCalls = interaction.steps.filter((s) => s.type === "function_call");

  if (functionCalls.length === 0) {
    console.log(`\n${interaction.output_text}`);
    break;
  }

  for (const fc of functionCalls) {
    console.log(`[tool] ${fc.name}(${JSON.stringify(fc.arguments)})`);
    const resultText = await runTool(fc.name, fc.arguments);
    history.push({
      type: "function_result",
      name: fc.name,
      call_id: fc.id,
      result: [{ type: "text", text: resultText }],
    });
  }
}