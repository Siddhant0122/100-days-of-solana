import {createSolanaRpc, devnet, address} from "@solana/kit";

const rpc = createSolanaRpc(devnet("https://api.devnet.solana.com"));

const targetAddress = address(
    "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"
)

//fetch the 5 most recent transaction signatures for this address
const signatures = await rpc
    .getSignaturesForAddress(targetAddress, {limit:5} )
    .send();

console.log(
    `\nLast 5 transactions for ${targetAddress}`
);

for(const tx of signatures){
    const time = tx.blockTime
    ? new Date(Number(tx.blockTime) * 1000).toLocaleString()
    : "unknown";
    
    console.log(`Signature : ${tx.signature}`);
    console.log(`Slot      : ${tx.slot}`);
    console.log(`Time      : ${time}`);
    console.log(`Status    : ${tx.err ? "Failed" : "Success"}`);
    console.log("--------------------------------------------------");
}