## Hand your agent a wallet and let it send SOL on devnet

At some point in the next hour, SOL is going to move between two accounts on devnet, and you will not have typed the recipient, the amount, or the send command. A language model will decide to make that transfer, your code will sign it, and the transaction will confirm on a public network. Yesterday your agent could only look. Today it can act, and the interesting part of the build is not the sending. It is deciding, in code, exactly how much acting you are willing to allow.

You already have every piece you need. You know how a keypair signs a transaction (Arc 1), how a System Program transfer moves lamports (Arc 3), and how an agent loop works: the model picks a tool, your code runs it, and the result goes back into the conversation (yesterday). Today you compose those three things and add one new idea, a policy guardrail: a rule enforced in your code, not in the prompt, that the model cannot talk its way past.

Your team was impressed by the read-only agent you demoed. Now someone asks the obvious next question: “Could it pay out the weekly contributor rewards automatically?” Your Web2 instincts immediately flag the risk. You would never give a cron job your personal AWS root credentials; you would create a service account with a narrowly scoped IAM policy, so that even buggy code can only do a small, bounded amount of damage. The same instinct applies here. The agent gets its own wallet, funded with a small amount of devnet SOL, and the code that holds the key enforces a hard cap on every transfer. The model reasons; the code holds the authority.

You will give your Day 92 agent two new abilities: checking its own wallet balance and sending SOL to an address. The wallet belongs to the agent, not to you, and a per-transfer spending cap lives in the tool code where no prompt can override it.

### Steps 
1. In your project folder, install the two packages for today: the @anthropic-ai/sdk client for the model and @anchor-lang/core, which gives you Connection, Keypair, SystemProgram, and the rest of the web3 namespace in a single import.
>npm install @anthropic-ai/sdk @anchor-lang/core

2. Create the agent’s own wallet. Save this as setup-wallet.mjs. It generates a fresh keypair, writes the secret key to agent-wallet.json, and requests a devnet airdrop so the agent has something to spend.
>import { writeFileSync } from "node:fs";
>import { web3 } from "@anchor-lang/core";
>
>const { Connection, Keypair, LAMPORTS_PER_SOL } = web3;
>
>const connection = new Connection("https://api.devnet.solana.com", "confirmed");
>const wallet = Keypair.generate();
>
>writeFileSync("agent-wallet.json", JSON.stringify(Array.from(wallet.secretKey)));
>console.log("Agent wallet address:", wallet.publicKey.toBase58());
>
>try {
>  const signature = await connection.requestAirdrop(wallet.publicKey, 2 * LAMPORTS_PER_SOL);
>  const latest = await connection.getLatestBlockhash();
>  await connection.confirmTransaction({ signature, ...latest });
>
>  const balance = await connection.getBalance(wallet.publicKey);
>  console.log("Funded with", balance / LAMPORTS_PER_SOL, "SOL on devnet");
>} catch (error) {
>  // Devnet airdrops are frequently rate limited. Do not crash — send the user to the faucet.
>  console.error("Airdrop failed:", error.message);
>  console.log(
>    "Fund the wallet manually at https://faucet.solana.com/ — paste this address:",
>    wallet.publicKey.toBase58(),
>  );
>}

Devnet airdrops are often rate limited. When that happens the catch block above keeps the script from crashing and prints the wallet address with the faucet link — open the Solana devnet faucet, paste that address, and fund it there instead.

3. Now the main event. Save this as agent.mjs. Read it before you run it, because the most important line is near the top: MAX_SOL_PER_SEND is the policy guardrail, and it is enforced inside the tool function, not in the instructions you give the model.
>import { readFileSync } from "node:fs";
>import Anthropic from "@anthropic-ai/sdk";
>import { web3 } from "@anchor-lang/core";
>
>const {
>  Connection, Keypair, PublicKey, SystemProgram,
>  Transaction, sendAndConfirmTransaction, LAMPORTS_PER_SOL,
>} = web3;
>
>const connection = new Connection("https://api.devnet.solana.com", "confirmed");
>const wallet = Keypair.fromSecretKey(
>  Uint8Array.from(JSON.parse(readFileSync("agent-wallet.json", "utf8")))
>);
>
>// Enforced in code. The model cannot override this, no matter what it is asked.
>const MAX_SOL_PER_SEND = 0.1;
>
>const tools = [
>  {
>    name: "get_balance",
>    description: "Get the current balance of the agent's own devnet wallet, in SOL.",
>    input_schema: { type: "object", properties: {} },
>  },
>  {
>    name: "send_sol",
>    description:
>      `Send SOL from the agent's wallet to a recipient on devnet. ` +
>      `Transfers above ${MAX_SOL_PER_SEND} SOL are rejected by policy.`,
>    input_schema: {
>      type: "object",
>      properties: {
>        recipient: { type: "string", description: "Base58 Solana address to send to" },
>        amount_sol: { type: "number", description: "Amount to send, in SOL" },
>      },
>      required: ["recipient", "amount_sol"],
>    },
>  },
>];
>
>async function runTool(name, input) {
>  if (name === "get_balance") {
>    const lamports = await connection.getBalance(wallet.publicKey);
>    return { balance_sol: lamports / LAMPORTS_PER_SOL };
>  }
>  if (name === "send_sol") {
>    if (input.amount_sol > MAX_SOL_PER_SEND) {
>      return {
>        error: `Rejected by policy: ${input.amount_sol} SOL exceeds the ` +
>               `${MAX_SOL_PER_SEND} SOL per-transfer cap.`,
>      };
>    }
>    let recipient;
>    try {
>      recipient = new PublicKey(input.recipient);
>    } catch {
>      return { error: `"${input.recipient}" is not a valid Solana address.` };
>    }
>    const transaction = new Transaction().add(
>      SystemProgram.transfer({
>        fromPubkey: wallet.publicKey,
>        toPubkey: recipient,
>        lamports: Math.round(input.amount_sol * LAMPORTS_PER_SOL),
>      })
>    );
>    let signature;
>    try {
>      signature = await sendAndConfirmTransaction(connection, transaction, [wallet]);
>    } catch (error) {
>      // A failed send is a normal result for the agent to report, not a crash.
>      const message = error?.message ?? String(error);
>      if (/no record of a prior credit|insufficient/i.test(message)) {
>        return {
>          error: `Send failed: the agent wallet ${wallet.publicKey.toBase58()} has no ` +
>                 `devnet SOL. Fund it at https://faucet.solana.com/ and try again.`,
>        };
>      }
>      return { error: `Send failed: ${message}` };
>    }
>    return {
>      signature,
>      explorer: `https://explorer.solana.com/tx/${signature}?cluster=devnet`,
>    };
>  }
>  return { error: `Unknown tool: ${name}` };
>}
>
>const client = new Anthropic();
>const messages = [{ role: "user", content: process.argv[2] }];
>
>while (true) {
>  const response = await client.messages.create({
>    model: "claude-sonnet-5",
>    max_tokens: 1024,
>    system:
>      "You are an agent that manages a small Solana devnet wallet. " +
>      "You can check its balance and send SOL. Always report transaction " +
>      "signatures and policy rejections back to the user honestly.",
>    tools,
>    messages,
>  });
>  messages.push({ role: "assistant", content: response.content });
>
>  if (response.stop_reason !== "tool_use") {
>    const text = response.content
>      .filter((block) => block.type === "text")
>      .map((block) => block.text)
>      .join("\n");
>    console.log("\nAgent:", text);
>    break;
>  }
>
>  const results = [];
>  for (const block of response.content) {
>    if (block.type !== "tool_use") continue;
>    console.log("Tool call:", block.name, JSON.stringify(block.input));
>    const result = await runTool(block.name, block.input);
>    console.log("Result:  ", JSON.stringify(result));
>    results.push({
>      type: "tool_result",
>      tool_use_id: block.id,
>      content: JSON.stringify(result),
>    });
>  }
>  messages.push({ role: "user", content: results });
>}

Two things to notice before moving on. First, the loop is the same shape as yesterday’s: the model runs until stop_reason is no longer "tool_use", meaning it has no more tools to call and is ready to answer. Second, the secret key never enters the model’s context. The model only ever sees tool names, inputs, and results. The key stays in your process, exactly like a service account credential that an API consumer uses but never exposes.

4. Fund the wallet, then give the agent a real task. Replace [YOUR_WALLET_ADDRESS] with your own wallet address from Arc 1, so the SOL lands somewhere you can verify.

### Run it
>node setup-wallet.mjs
>
>node agent.mjs "Check your balance, then send 0.05 SOL to [YOUR_WALLET_ADDRESS] and report the transaction signature."
>
>node agent.mjs "Send 1 SOL to [YOUR_WALLET_ADDRESS]."

Watch the second run closely. The model will call send_sol, decide on the amount and recipient entirely on its own, and your terminal will print a real transaction signature. Open the explorer link it returns and there it is: a confirmed devnet transfer that an AI initiated. Then run the third command. The model will try, the tool will reject it, and the agent will come back and tell you the transfer exceeded policy. That refusal did not come from the model being cautious. It came from your code.

You separated two things that are easy to conflate: deciding and authorizing. The model decided to send SOL, picked the amount, and chose the recipient by reading your plain-English request. But the authority to sign lived entirely in your code, behind a function with a hard-coded cap. This is the same architecture you would use for any automated API consumer in your Web2 work that touches money or production data: the automation gets a scoped credential, and the scope is enforced by the system, never by asking the automation to behave. A prompt is a suggestion; a cap in code is a law.

This matters more with agents than with ordinary scripts because a model’s behavior is not fully predictable. It might misread an amount, get confused by an ambiguous request, or someday be manipulated by text it encounters. The guardrail means the blast radius of any of those failures is 0.1 SOL, on devnet, from a wallet holding 2. When you saw the policy rejection flow back through the loop and the agent explain it honestly, you saw the whole pattern working: the model is free to reason, and the code decides what is actually allowed. The rest of this arc builds on exactly this foundation.

