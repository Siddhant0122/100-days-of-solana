import { web3 } from "@anchor-lang/core";

const { PublicKey, LAMPORTS_PER_SOL } = web3;

// Deny by default: only addresses in this set can ever receive funds.
const ALLOWED_RECIPIENTS = new Set([
  "j21RY95MTUZtuGFk5LqzK52ZfWtny5o7iFV96hUeF74",
]);

const MAX_LAMPORTS_PER_TRANSFER = 0.1 * LAMPORTS_PER_SOL;  // 0.1 SOL per transfer
const MAX_LAMPORTS_PER_SESSION = 0.25 * LAMPORTS_PER_SOL;  // 0.25 SOL total per run

let sessionSpent = 0;

// Returns { allowed, reason }. Deny by default: every rule is a reason to say no.
export function checkTransferPolicy(recipient, lamports) {
  let recipientKey;
  try {
    recipientKey = new PublicKey(recipient);
  } catch {
    return {
      allowed: false,
      reason: `"${recipient}" is not a valid Solana address.`,
    };
  }

  if (!ALLOWED_RECIPIENTS.has(recipientKey.toBase58())) {
    return {
      allowed: false,
      reason: `Recipient ${recipientKey.toBase58()} is not on the allowlist. No transfer to an unlisted address will be signed.`,
    };
  }

  if (!Number.isInteger(lamports) || lamports <= 0) {
    return {
      allowed: false,
      reason: `Amount must be a positive whole number of lamports, got ${lamports}.`,
    };
  }

  if (lamports > MAX_LAMPORTS_PER_TRANSFER) {
    return {
      allowed: false,
      reason: `Amount ${lamports / LAMPORTS_PER_SOL} SOL exceeds the per-transfer cap of ${MAX_LAMPORTS_PER_TRANSFER / LAMPORTS_PER_SOL} SOL.`,
    };
  }

  if (sessionSpent + lamports > MAX_LAMPORTS_PER_SESSION) {
    return {
      allowed: false,
      reason: `This transfer would push session spending past the cap of ${MAX_LAMPORTS_PER_SESSION / LAMPORTS_PER_SOL} SOL. Already spent: ${sessionSpent / LAMPORTS_PER_SOL} SOL.`,
    };
  }

  return { allowed: true, reason: "Within policy." };
}

export function recordSpend(lamports) {
  sessionSpent += lamports;
}
