## Write helpful messages for failed wallet transactions

Three seconds after someone clicks “Send” in your app, one of several things happens: the transaction confirms, the user closes the wallet popup without approving, the account turns out to be a few thousand lamports short of the fee, or the blockhash quietly expires while the wallet sits open on a second monitor. Only the first of those is the happy path you tested on Day 88. The other three are what production actually looks like, and right now they all crash into the same unhandled catch block and surface as a red stack trace that means nothing to the person staring at it.

Today is an experiment. You are going to write a single function that takes any error thrown during a send and sorts it into a category with a human-readable message, then deliberately trigger each failure mode and watch how your classifier responds. The goal is not to make errors disappear. It is to make every error legible: to you in the console with full detail, and to the user on screen with a calm sentence they can act on.

Your devnet frontend works beautifully when you drive it: connect Phantom, type an amount, approve, watch the signature appear. But a frontend in production is driven by strangers on flaky networks with locked wallets and empty accounts. A user who sees “Error: Unexpected error (see console)” assumes your app is broken and leaves. A user who sees “You closed the wallet before approving, nothing was sent” understands exactly what happened and tries again.

The difference between those two experiences is one layer of translation between the raw error object and the screen. Errors on Solana arrive from two different worlds: the wallet (the user rejected the request, the wallet is locked or disconnected) and the network (the blockhash expired, the account is underfunded, the RPC timed out). A production app has to recognize both and respond differently to each, because some are the user’s choice, some are retryable, and some are dead ends.

### Steps
1. Write the classifier as a pure function. Create a new file, src/walletErrors.ts. This function takes whatever was thrown and returns a small, predictable object: a machine-readable kind, a title and message for the screen, whether the action is worth retrying, and a severity your UI can style. Keeping it pure (no React, no side effects) means you can reason about it and test it in isolation.

>import {
>  isSolanaError,
>  SOLANA_ERROR__BLOCK_HEIGHT_EXCEEDED,
>} from "@solana/kit";
>
>export type WalletErrorInfo = {
>  kind: string;
>  title: string;
>  message: string;
>  retryable: boolean;
>  severity: "info" | "warning" | "error" | "success";
>};
>
>export function classifyWalletError(error: unknown): WalletErrorInfo {
>  // 1. The user closed the wallet popup or clicked "Cancel".
>  //    This is a choice, not a failure. Treat it gently.
>  if (isUserRejection(error)) {
>    return {
>      kind: "user-rejected",
>      title: "Transaction cancelled",
>      message: "You closed the wallet before approving. Nothing was sent.",
>      retryable: true,
>      severity: "info",
>    };
>  }
>
>  // 2. The transaction's blockhash expired before it confirmed.
>  //    @solana/kit gives this a specific, checkable error code.
>  if (unwrap(error).some((e) => isSolanaError(e, SOLANA_ERROR__BLOCK_HEIGHT_EXCEEDED))) {
>    return {
>      kind: "blockhash-expired",
>      title: "Transaction expired",
>      message:
>        "It took too long to confirm. Try again to send it with a fresh blockhash.",
>      retryable: true,
>      severity: "warning",
>    };
>  }
>
>  // 3. The wallet signed, but the account cannot cover amount + fee.
>  if (/insufficient (lamports|funds)/i.test(messageOf(error))) {
>    return {
>      kind: "insufficient-funds",
>      title: "Not enough SOL",
>      message:
>        "This account does not have enough SOL to cover the amount plus the network fee.",
>      retryable: false,
>      severity: "error",
>    };
>  }
>
>  // 4. Anything we did not anticipate. Log the real thing, show a calm line.
>  return {
>    kind: "unknown",
>    title: "Something went wrong",
>    message: messageOf(error) || "An unexpected error occurred. Please try again.",
>    retryable: true,
>    severity: "error",
>  };
>}
>
>function isUserRejection(error: unknown): boolean {
>  // Wallets are inconsistent here. Some set a numeric code (4001, a
>  // convention borrowed from browser wallet providers); others only put
>  // the reason in the message. Match on several signals, not just one.
>  if (unwrap(error).some((e) => (e as { code?: number })?.code === 4001)) return true;
>  return /(user rejected|user denied|rejected the request|cancell?ed)/i.test(
>    messageOf(error),
>  );
>}
>
>function messageOf(error: unknown): string {
>  return unwrap(error)
>    .map((e) => (typeof e === "string" ? e : (e as { message?: string })?.message ?? ""))
>    .filter(Boolean)
>    .join(" | ");
>}
>
>// @solana/kit wraps the real failure ("transaction plan failed to execute")
>// around the underlying error, so the useful code and message live in a
>// nested .cause. Walk the chain so every check above can see them.
>function unwrap(error: unknown): unknown[] {
>  const chain: unknown[] = [];
>  const seen = new Set<unknown>();
>  let current: unknown = error;
>  while (current != null && !seen.has(current)) {
>    seen.add(current);
>    chain.push(current);
>    current = typeof current === "object" ? (current as { cause?: unknown }).cause : undefined;
>  }
>  return chain;
>}

2. Wire it into your send handler. On Day 88 your button called send inline. Pull that call out into a handleSend function and wrap it in a try/catch, then point the button at it (onClick={handleSend}). The catch splits the outcome into two audiences: the full error to the console for you, the classified result to your status UI for the user.

>import { classifyWalletError, type WalletErrorInfo } from "./walletErrors";
>
>// name it sendStatus — App.tsx already has a `status` from useWalletConnection:
>const [sendStatus, setSendStatus] = useState<WalletErrorInfo | null>(null);
>
>async function handleSend() {
>  setSendStatus(null);
>  try {
>    const signature = await send({ amount: 1_000_000n, destination }); // send() from Day 88's useSolTransfer
>    setSendStatus({
>      kind: "success",
>      severity: "success",
>      title: "Sent",
>      message: `Confirmed: ${signature}`,
>      retryable: false,
>    });
>  } catch (error) {
>    const info = classifyWalletError(error);
>    console.error(`[wallet:${info.kind}]`, error); // full detail, for you
>    setSendStatus(info);                           // friendly detail, for them
>  }
>}

3. Render the status below your send button. This is additional UI — add it right after the button’s closing </div>, do not replace the button (your send button and its isSending label stay exactly as they are). Key the styling off severity so an info cancellation does not look like an error, and only show a retry affordance when retryable is true.

>{sendStatus && (
>  <div className={`status status--${sendStatus.severity}`} role="status">
>    <strong>{sendStatus.title}</strong>
>    <p>{sendStatus.message}</p>
>    {sendStatus.retryable && sendStatus.severity !== "success" && (
>      <button onClick={handleSend}>Try again</button>
>    )}
>  </div>
>)}

(className="status …" and role="status" are just CSS/ARIA strings — only the sendStatus variable was renamed.)

4. Now run the experiments. This is the heart of the day. Trigger each failure on purpose and write down what you observe: which kind fires, what lands in the console, and what the user sees on screen.

    1. Reject the popup. Start a send, and when the wallet asks for approval, click “Cancel” or just close it. You should land in user-rejected with a calm, blue-ish info message and no scary red. Confirm nothing was submitted.
    2. Overspend the account. Type an amount larger than the wallet’s devnet balance and approve it. Watch whether you hit insufficient-funds with a clear, non-retryable message. Note where the error originates: did the wallet refuse, or did the network reject the submitted transaction?
    3. Disconnect mid-flow. Disconnect or lock the wallet, then click send. Observe which bucket this falls into. With the four cases above it will probably land in unknown, and that is the point: you just discovered a category your classifier does not handle yet.
    4. Force an expiry (advanced, optional). Blockhash expiry is hard to trigger by hand because devnet confirms quickly. Read how it happens in the Helius blockhash guide, then simulate it: temporarily throw a hand-built Solana error from your send function to confirm the blockhash-expired branch and its retry button render correctly.

5. Close the loop you found. Experiment 3 surfaced a gap. Add a fifth branch to classifyWalletError for a disconnected or locked wallet (match on messages like not connected, disconnected, or no .* account), give it a retryable message that nudges the user to reconnect, and re-run the experiment to confirm it now classifies cleanly. This is the experiment paying off: real errors taught you which cases your code was missing.

### Run it
>npm run dev

Open the app in your browser, connect your devnet wallet, and walk through experiments 1 through 3 one at a time, keeping the developer console open so you can see both halves of every failure.