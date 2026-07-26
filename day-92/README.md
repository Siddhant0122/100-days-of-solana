## Ask an AI agent to read devnet for you

Arc theme: Agentic Solana

Web2 bridge: AI agents that interact with blockchain are like automated API consumers that can read, write, and reason about on-chain state

“How much SOL is in my wallet right now, and who owns my program account?” For the past 91 days, answering a question like that meant you opened Solana Explorer, ran a script, or called an RPC method yourself. Today you will type that question in plain English, press enter, and watch an AI agent decide on its own which RPC calls to make, fetch live state from devnet, and answer you in a sentence.

This is the start of your next step in the journey, and it introduces one new idea: an AI agent is a language model running in a loop with access to tools. You describe the tools in plain language, the model decides when to call them, your code executes the calls, and the results go back to the model so it can reason about them. If you have ever written an automated API consumer in your Web2 work, a script that polls an endpoint and acts on the response, an agent is that same pattern with a reasoning engine in the middle. Today the agent only reads. Tomorrow it gets a wallet.

You shipped a program to mainnet-beta in Arc 13, and you know exactly how to inspect on-chain state by hand: getBalance for lamports, getAccountInfo for the raw account, Explorer for everything else. But every one of those checks starts with you translating a human question (“is my program still funded?”) into a specific RPC call against a specific address.

AI agents flip that translation around. You expose a small set of read-only tools, each one a thin wrapper around an RPC call you already know, and let a model do the translating. The model never touches the network directly. It can only ask your code to run the tools you defined, which makes a read-only agent a very safe first step: the worst it can do is look something up.

Build a small Node.js script that connects Claude to Solana devnet through two tools, get_balance and get_account_info, then ask it questions about accounts you own.

### Steps
1. Create a fresh project and install the Anthropic SDK alongside @anchor-lang/core, which you already know gives you Connection, PublicKey, and LAMPORTS_PER_SOL:

>mkdir solana-read-agent && cd solana-read-agent
>npm init -y
>npm pkg set type=module
>npm install @anthropic-ai/sdk @anchor-lang/core

2. Create agent.js and start with the devnet connection plus the tool definitions. The description fields are not decoration: they are the only thing the model reads to decide which tool fits the question, so write them the way you would write good API docs:

>import Anthropic from "@anthropic-ai/sdk";
>import { web3 } from "@anchor-lang/core";
>
>const { Connection, PublicKey, LAMPORTS_PER_SOL } = web3;
>
>const connection = new Connection("https://api.devnet.solana.com", "confirmed");
>
>const tools = [
>  {
>    name: "get_balance",
>    description:
>      "Get the current SOL balance of a Solana account on devnet. " +
>      "Returns the balance in both lamports and SOL.",
>    input_schema: {
>      type: "object",
>      properties: {
>        address: {
>          type: "string",
>          description: "The base58-encoded Solana address to check",
>        },
>      },
>      required: ["address"],
>    },
>  },
>  {
>    name: "get_account_info",
>    description:
>      "Fetch metadata for a Solana account on devnet: which program owns it, " +
>      "its lamport balance, whether it is executable, and how many bytes of data it stores.",
>    input_schema: {
>      type: "object",
>      properties: {
>        address: {
>          type: "string",
>          description: "The base58-encoded Solana address to inspect",
>        },
>      },
>      required: ["address"],
>    },
>  },
>];

3. Below that, add the executor. This is the bridge between the model’s structured request and the RPC calls you have been making since Arc 2. Notice that a bad address does not crash the script; the error goes back to the model as a tool result so it can explain the problem or try again:
>async function runTool(name, input) {
>  try {
>    const pubkey = new PublicKey(input.address);
>    if (name === "get_balance") {
>      const lamports = await connection.getBalance(pubkey);
>      return { content: JSON.stringify({ lamports, sol: lamports / LAMPORTS_PER_SOL }) };
>    }
>    if (name === "get_account_info") {
>      const info = await connection.getAccountInfo(pubkey);
>      if (!info) return { content: JSON.stringify({ exists: false }) };
>      return {
>        content: JSON.stringify({
>          exists: true,
>          owner: info.owner.toBase58(),
>          lamports: info.lamports,
>          executable: info.executable,
>          dataLength: info.data.length,
>        }),
>      };
>    }
>    return { content: `Unknown tool: ${name}`, isError: true };
>  } catch (err) {
>    return { content: `Tool error: ${err.message}`, isError: true };
>  }
>}

4. Finish with the agent loop itself. The whole pattern is here: call the model, and if it stops because it wants a tool (stop_reason === "tool_use"), run the tool, append the result to the conversation, and call the model again. When it stops for any other reason, it has an answer:

>const client = new Anthropic();
>
>const question =
>  process.argv.slice(2).join(" ") ||
>  "What is the SOL balance of YOUR_WALLET_ADDRESS_HERE?";
>
>const messages = [{ role: "user", content: question }];
>
>while (true) {
>  const response = await client.messages.create({
>    model: "claude-sonnet-5",
>    max_tokens: 1024,
>    system:
>      "You are a Solana devnet assistant. Use your tools to look up live " +
>      "on-chain state before answering. Report balances in both lamports and SOL.",
>    tools,
>    messages,
>  });
>
>  messages.push({ role: "assistant", content: response.content });
>
>  if (response.stop_reason !== "tool_use") {
>    const text = response.content
>      .filter((block) => block.type === "text")
>      .map((block) => block.text)
>      .join("\n");
>    console.log(`\n${text}`);
>    break;
>  }
>
>  const toolResults = [];
>  for (const block of response.content) {
>    if (block.type !== "tool_use") continue;
>    console.log(`[tool] ${block.name}(${JSON.stringify(block.input)})`);
>    const result = await runTool(block.name, block.input);
>    toolResults.push({
>      type: "tool_result",
>      tool_use_id: block.id,
>      content: result.content,
>      is_error: result.isError ?? false,
>    });
>  }
>  messages.push({ role: "user", content: toolResults });
>}

5. Ask it real questions. Start with your own wallet, then point it at your deployed program ID, then at the System Program address you met in Arc 4 (11111111111111111111111111111111) and see if it correctly reports that account as executable. Try a question that needs two lookups, like comparing the balances of two addresses, and watch the agent chain the tool calls without being told to.

### Run it
>export ANTHROPIC_API_KEY="sk-ant-your-key-here"
>
>node agent.js "How much SOL does YOUR_WALLET_ADDRESS have, and is it enough to cover a few thousand transaction fees?"
>
>node agent.js "Look up YOUR_PROGRAM_ID. Who owns it, and is it executable?"