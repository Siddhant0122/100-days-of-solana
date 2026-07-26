import {
  isSolanaError,
  SOLANA_ERROR__BLOCK_HEIGHT_EXCEEDED,
} from "@solana/kit";

export type WalletErrorInfo = {
  kind: string;
  title: string;
  message: string;
  retryable: boolean;
  severity: "info" | "warning" | "error" | "success";
};

export function classifyWalletError(error: unknown): WalletErrorInfo {
  // 1. The user closed the wallet popup or clicked "Cancel".
  //    This is a choice, not a failure. Treat it gently.
  if (isUserRejection(error)) {
    return {
      kind: "user-rejected",
      title: "Transaction cancelled",
      message: "You closed the wallet before approving. Nothing was sent.",
      retryable: true,
      severity: "info",
    };
  }

  // 2. The transaction's blockhash expired before it confirmed.
  //    @solana/kit gives this a specific, checkable error code.
  if (unwrap(error).some((e) => isSolanaError(e, SOLANA_ERROR__BLOCK_HEIGHT_EXCEEDED))) {
    return {
      kind: "blockhash-expired",
      title: "Transaction expired",
      message:
        "It took too long to confirm. Try again to send it with a fresh blockhash.",
      retryable: true,
      severity: "warning",
    };
  }

  // 3. The wallet signed, but the account cannot cover amount + fee.
  if (/insufficient (lamports|funds)/i.test(messageOf(error))) {
    return {
      kind: "insufficient-funds",
      title: "Not enough SOL",
      message:
        "This account does not have enough SOL to cover the amount plus the network fee.",
      retryable: false,
      severity: "error",
    };
  }

  // 4. Anything we did not anticipate. Log the real thing, show a calm line.
  return {
    kind: "unknown",
    title: "Something went wrong",
    message: messageOf(error) || "An unexpected error occurred. Please try again.",
    retryable: true,
    severity: "error",
  };
}

function isUserRejection(error: unknown): boolean {
  // Wallets are inconsistent here. Some set a numeric code (4001, a
  // convention borrowed from browser wallet providers); others only put
  // the reason in the message. Match on several signals, not just one.
  if (unwrap(error).some((e) => (e as { code?: number })?.code === 4001)) return true;
  return /(user rejected|user denied|rejected the request|cancell?ed)/i.test(
    messageOf(error),
  );
}

function messageOf(error: unknown): string {
  return unwrap(error)
    .map((e) => (typeof e === "string" ? e : (e as { message?: string })?.message ?? ""))
    .filter(Boolean)
    .join(" | ");
}

// @solana/kit wraps the real failure ("transaction plan failed to execute")
// around the underlying error, so the useful code and message live in a
// nested .cause. Walk the chain so every check above can see them.
function unwrap(error: unknown): unknown[] {
  const chain: unknown[] = [];
  const seen = new Set<unknown>();
  let current: unknown = error;
  while (current != null && !seen.has(current)) {
    seen.add(current);
    chain.push(current);
    current = typeof current === "object" ? (current as { cause?: unknown }).cause : undefined;
  }
  return chain;
}
