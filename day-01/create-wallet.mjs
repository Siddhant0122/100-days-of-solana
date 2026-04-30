import {generateKeyPairSigner, 
    createSolanaRpc,
    devnet,
 } from "@solana/kit";

const rpc = createSolanaRpc(devnet("https://api.devnet.solana.com"));
// const wallet = await generateKeyPairSigner(); //generates a address

// console.log("Wallet address: ", wallet.address); //address of wallet created
// console.log("\n--- Go to https://faucet.solana.com/ and airdrop SOL to this address ---");
// console.log("--- Then run this script again with the same address to check the balance ---\n");

const wallet = "GB5tFWAq5Lny2Atp7utJmNS4jvLhoxng9CZpHwMfai5z";//randomly generated address from above code snippet, you can use your own address here to check balance after airdropping SOL to it
console.log("Wallet address: ", wallet);
const {value: balance} = await rpc.getBalance(wallet).send();
const balanceInSol = Number(balance) / 1_000_000_000;

console.log(`Balance ${balanceInSol} SOL`)

//console.log("Your new wallet address:", wallet)
//console.log(
//  "\nThis address is your public key. It's safe to share."
//);
// console.log(
//   "The private key stays in memory. In a real app, you'd save it securely."
// ); 