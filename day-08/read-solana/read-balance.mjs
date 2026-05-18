import {createSolanaRpc, devnet, address} from "@solana/kit";

//Connect to devnet (Solana's test network)
const rpc = createSolanaRpc(devnet("https://api.devnet.solana.com"));

//4ZmLQheanGDHvBW3YcN4z61H8uYzLi4ZuPoLAsXwf6oZ
const targetAddress = address(
    "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"
);

//Query the balance , just like calling a Rest API
const {value: balanceInLamports } = await rpc 
    .getBalance(targetAddress)
    .send();

//Lamports are solana's smallest unit. 1 Sol = 1,000,000,000 Lamports 
const balanceSol = Number(balanceInLamports) / 1_000_000_000 ;

console.log(`Address : ${targetAddress}`)
console.log(`Balance : ${balanceSol} SOL`)
