import {createSolanaRpc, devnet, address} from "@solana/kit";

const rpc = createSolanaRpc(devnet("https://api.devnet.solana.com"));
const addressInput = document.getElementById("addressInput");
const fetchBtn = document.getElementById("fetchBtn");
const resultDiv = document.getElementById("results");
const errorDiv = document.getElementById("error");
const loadingDiv = document.getElementById("loading");

fetchBtn.addEventListener("click", async()=>{
  errorDiv.textContent = "";
  resultDiv.innerHTML = "";
  loadingDiv.textContext = "Fetching...";

  try{
    const targetAddress = address(addressInput.value.trim());

    //fetch balance
    const {value: balanceInLamports } = await rpc
    .getBalance(targetAddress)
    .send();
    const balanceInSol = Number(balanceInLamports) / 1_000_000_000;

    //fetch recent transaction
    const signatures = await rpc
    .getSignaturesForAddress(targetAddress)
    .send();

    //render balance
    let html = `<div class="balance">${balanceInSol}</div>`
    html += `<h3>Recent Transaction</h3>`

    if(signatures.length === 0){
      html += `<p>No trasactions found for this address.</p>`
    }

    //render transaction
    //for last 5 transaction remove if statement then you can get a lot trasaction just to end loop to 
    //this public address TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb which has many transactions 
    let i = 0;
    for(const tx of signatures){
      if (i<5) {
        const time = tx.blockTime
        ? new Date(Number(tx.blockTime) * 1000).toLocaleString()
        : "unknown";
        const statusClass = tx.err ? "status failed" : "status";
        const statusText = tx.err ? "Failed" : "Success";

        html += `
          <div class="tx">
            <div><strong>Signatures:</strong> ${tx.signature}</div>
            <div><strong>Slot:</strong> ${tx.slot}</div>
            <div><strong>Time:</strong> ${time}</div>
            <div class="${statusClass}"><strong>Status:</strong> ${statusText}</div>
          </div>
        `;
        i++;
      }else{
        break;
      }
    }
    resultDiv.innerHTML = html;
    
    
  }catch(err){
    errorDiv.textContent = `Error: ${err.message}`;
  }finally{
    loadingDiv.textContent = "";
  }
});