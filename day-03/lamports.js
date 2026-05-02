// 1 SOL = 1_000_000_000 Lamports (10^9);\
// const balance = await connection.getBalance(publicKey);
// console.log(balance);
// 2000000000 (this is lamports, not SOL)
// const fees = await connection.getFeeForMessage(message);
// console.log(fees.value);
// 5000 (lamports, that's 0.000005 SOL)

import { LAMPORTS_PER_SOL } from "@solana/web3.js";

const solAmount = 1.5;
const lamports = solAmount * LAMPORTS_PER_SOL;
console.log(lamports);
// 1500000000