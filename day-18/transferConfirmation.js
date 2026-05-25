import {
    address,
    createKeyPairSignerFromBytes,
    createSolanaRpc,
    createSolanaRpcSubscriptions,
    pipe,
    createTransactionMessage,
    setTransactionMessageFeePayerSigner,
    setTransactionMessageLifetimeUsingBlockhash,
    appendTransactionMessageInstruction,
    signTransactionMessageWithSigners,
    getSignatureFromTransaction,
    getBase64EncodedWireTransaction,
    lamports,
    devnet,
} from "@solana/kit";
import { getTransferSolInstruction } from "@solana-program/system"
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { homedir } from "node:os";

//Configuration
const RPC_URL = devnet("https://api.devnet.solana.com");
const WS_URL = devnet("wss://api.devnet.solana.com");
const LAMPORTS_PER_SOL = 1_000_000_000n;
const COMMITMENT_LEVELS = ["processed", "confirmed", "finalized"]; 

//Parse-command-line arguments
const args = process.argv.slice(2);
if(args.length < 2){
    console.error("Usage: node transfer.mjs <RECIPIENT_ADDRESS> <AMOUNT_IN_SOL>");
    console.error("Example: node transfer.mjs GrAkKfEpTKQuVHG2Y97Y2FF4i7y7Q5AHLK94JBy7Y5yv 0.1");
    process.exit(1);
}

const recipentAddress = address(args[0]);
const solAmount = parseFloat(args[1]);

if(isNaN(solAmount) || solAmount <= 0){
    console.error("Error: Amount must be a positive number.");
    process.exit(1);
}

const transferLamports = lamports(BigInt(Math.round(solAmount * Number(LAMPORTS_PER_SOL))));

//Load your keypair from the default Solana CLI location
async function loadKeypair() {
    const keypairPath = resolve(homedir(), ".config", "solana", "id.json");
    const secretKeyJson = await readFile(keypairPath, "utf-8");
    const secretKeyBytes = new Uint8Array(JSON.parse(secretKeyJson));
    const keyPair = await createKeyPairSignerFromBytes(secretKeyBytes);
    return keyPair;
}

function statusUpdate(message){
    process.stdout.clearLine(0);
    process.stdout.cursorTo(0);
    process.stdout.write(message);
}

async function waitForCommitment(rpc, signature, targetCommitment){
    const targetIndex = COMMITMENT_LEVELS.indexOf(targetCommitment);

    while(true){
        const {value} = await rpc
        .getSignatureStatuses([signature], {searchTransactionHistory: true})
        .send();

        const status = value[0];

        if(status?.err){
            throw new Error(`Transaction failed on-chain: ${JSON.stringify(status.err)}`);
        }

        if(status){
            const currentIndex = COMMITMENT_LEVELS.indexOf(status.confirmationStatus);
            if(currentIndex >= targetIndex) break; 
        }

        await new Promise((r) => setTimeout(r, 500));
    }
}

async function transferWithConfirmation(rpc, signer, toAddress, amountInSol){
    const destination = address(toAddress);
    const lamportAmount = lamports(BigInt(Math.round(amountInSol * Number(LAMPORTS_PER_SOL))));

    const {value: latestBlockhash} = await rpc.getLatestBlockhash().send();

    const transactionMessage = pipe(
        createTransactionMessage({version: 0}),
        (tx) => setTransactionMessageFeePayerSigner(signer, tx),
        (tx) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
        (tx) => appendTransactionMessageInstruction(
            getTransferSolInstruction({
                source: signer,
                destination,
                amount: lamportAmount,
            }),tx
        )
    );

    const signedTransaction = await signTransactionMessageWithSigners(transactionMessage);
    const signature = getSignatureFromTransaction(signedTransaction);
    const wireTransaction = getBase64EncodedWireTransaction(signedTransaction);

    console.log(`\nSending ${amountInSol} SOL to ${toAddress}...\n`);

    //Step A: Send the transaction
    statusUpdate("Status: Sending transaction...");
    await rpc.sendTransaction(wireTransaction, {encoding: "base64"}).send();
    
    statusUpdate("Status: Processed (included in a block)...");

    //Step B: Wait for confirmed status
    await waitForCommitment(rpc, signature, "confirmed");
    statusUpdate("Status: Confirmed (supermajority voted)...")

    // Step C: Wait for finalized status
    await waitForCommitment(rpc, signature, "finalized");
    statusUpdate("Status: Finalized (irreversible)");

    console.log("\n");

    return signature;
}

//Main Function
async function main(){
    console.log("Solana Transfer Tool");
    console.log("====================\n");


    const rpc = createSolanaRpc(RPC_URL);
    const rpcSubscriptions = createSolanaRpcSubscriptions(WS_URL);
    console.log("Connected to Solana devnet.\n");


    const sender = await loadKeypair();
    console.log("Sender: ",sender.address);
    console.log("Recipents: ", recipentAddress.toString());
    console.log("Amount: ", solAmount,"SOL\n");


    const {value: balance} = await rpc.getBalance(sender.address).send();
    const balanceInSol = Number(balance)/ Number(LAMPORTS_PER_SOL);
    console.log(`Sender balance: ${balanceInSol} SOL`);

    if (balance < transferLamports){
        console.error(
            `\nInsufficient funds. You need at least ${solAmount} SOL plus a small fee.`
        );
        console.error("Get more devnet SOL at https://faucet.solana.com/");
        process.exit(1);
    }

    try{
        const signature = await transferWithConfirmation(rpc, sender, recipentAddress, solAmount);
        
        console.log("Transaction successful!");
        console.log(`Signature: ${signature}`);
        console.log(`View on Solana Explorer:`);
        console.log(`https://explorer.solana.com/tx/${signature}?cluster=devnet`);
    }catch(error){
        console.error("\nTransaction failed:");
        console.error(error.message);
        process.exit(1);
    }

    const {value: newBalance} = await rpc.getBalance(sender.address).send();
    const newBalanceInSol = Number(newBalance)/ Number(LAMPORTS_PER_SOL);
    console.log(`\nNew sender balance: ${newBalanceInSol} SOL`);

}

main().catch((err)=>{
    console.error("\nTransfer failed:", err.message);
    process.exit(1);
});