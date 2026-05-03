import {createSolanaRpc, devnet } from "@solana/kit" ;
import {getWallets} from "@wallet-standard/app";

const rpc = createSolanaRpc(devnet("https://api.devnet.solana.com"));
const walletListDiv = document.getElementById("wallet-list");
const connectDiv = document.getElementById("connected");
const statusDiv = document.getElementById("status");
const errorDiv = document.getElementById("error");

let connectedWallet = null;

function isSolanaWallet(wallet){
  return wallet.chains?.some((chain) => chain.startsWith("solana:"));
}

function renderWalletList(wallets){
  const solanaWallets = wallets.filter(isSolanaWallet);

  if(solanaWallets.length === 0){
    walletListDiv.innerHTML = `
    <div class="no-wallets">
      No Solana wallets found. <br>
      Install <a href="https://phantom.app" target="_blank">Phantom</a>
      or another Solana wallet to continue.
    </div>  
    `;
    statusDiv.textContent = "";
    return;
  }
  statusDiv.textContent = `Found ${solanaWallets.length} wallet(s)`;
  walletListDiv.innerHTML = "";

  for(const wallet of solanaWallets){
    const btn = document.createElement("button");
    btn.className = "wallet-btn";
    const icon = wallet.icon;
    btn.innerHTML = icon
    ? `<img src="${icon}" alt="" > ${wallet.name}`
    : wallet.name;
    btn.addEventListener("click", ()=> connectWallet(wallet));
    walletListDiv.appendChild(btn); 
  }
}

async function connectWallet(wallet){
  errorDiv.textContent = "";
  const connectFeature = wallet.features["standard:connect"];
  if(!connectFeature){
    errorDiv.textContent = "This wallet doesn't support connecting."
    return;
  }
  
  try{
    statusDiv.textContent = "Request connection...";
    const { accounts } = await connectFeature.connect();

    if(accounts.length === 0){
      errorDiv.textContent = "No account returned. Did you reject the request?";
      statusDiv.textContent = "";
      return;
    }

    connectedWallet = wallet;
    const account = accounts[0];
    const address = account.address;

    const {value: balanceInLamports } = await rpc.getBalance(address).send();
    const balanceInSol = (Number(balanceInLamports) / 1_000_000_000).toFixed(9);

    walletListDiv.style.display = "none";
    statusDiv.textContent = "";
    connectDiv.style.display = "block";
    connectDiv.innerHTML = `
      <h3>Connected to ${wallet.name}</h3>
      <div class="address">${address}</div>
      <div class="balance">${balanceInSol}</div>
      <button class="disconnect-btn" id="disconnectBtn">Disconnect</button>
    `;
    document
      .getElementById("disconnectBtn")
      .addEventListener("click", () => disconnectWallet(wallet));
  }catch(err){
    errorDiv.textContent = `Connection failed: ${err.message}`;
    statusDiv.textContent = "";
  }
}

async function disconnectWallet(wallet){
  const disconnectFeature = wallet.features["standard:disconnect"];
  if(disconnectFeature){
    await disconnectFeature.disconnect();
  }
  connectedWallet = null;
  connectDiv.style.display = "none";
  walletListDiv.style.display = "block";
  statusDiv.textContent = "Disconnected. Choose a wallet to reconnect:";
}

const { get,on } = getWallets();
renderWalletList(get());
on("register", ()=>{
  if(!connectedWallet){
    renderWalletList(get());
  }
});

