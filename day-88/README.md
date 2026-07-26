## Let users connect a wallet and send a transaction

Open a well-built Solana app, click “Connect,” and every wallet you have installed appears in a single list: Phantom, Solflare, Backpack, whatever you keep in your browser. The app did not ship a line of Phantom-specific code or a hardcoded menu of wallet names. It simply asked the browser, “who is here?” and the wallets answered. That conversation has a name: the Wallet Standard, a shared interface that every modern Solana wallet implements so that any app can discover and talk to any wallet through one common API.

Today you reconnect everything you have built to a real user interface. The keypair you generated back in Arc 1 is an on-chain identity; the balance reads you did in Arc 2 are RPC calls; your vault program, which you just promoted and gave an IDL to, is waiting for callers. A frontend is where a human meets all of that. By the end of this challenge you will have a React app running in your browser, a real wallet connected to it through the Wallet Standard, and your own devnet identity and balance showing up on the page.

You have spent weeks living in the terminal: anchor build, anchor program deploy, test files, RPC scripts. That is exactly where a program author should live. But nobody downloads a CLI to use your app. They open a tab, they click a button, and they expect their wallet to pop up and ask for approval, the same way a “Sign in with Google” button works in the Web2 apps you already build.

The good news is that the hardest part of that experience is already solved for you. You will not write a custom integration for each wallet brand, and you will not paste in a private key anywhere near your frontend. The Wallet Standard handles discovery, and a small React library renders the connect button and manages the connection state. Your job is to wire it up, point it at devnet, and confirm that the identity flowing into the browser is the same one you have been using all along.

### Steps
1. Scaffold a frontend with the official Solana template. The Solana Foundation maintains create-solana-dapp, a generator that wires up a React app with a wallet connection already in place. Run it, and at the prompts pick the Kit Framework group, then the react-vite template. It is built on @solana/react-hooks and @solana/client — the current official React stack. You can browse the full set of starters in the templates gallery.

>npx create-solana-dapp@latest my-solana-frontend
>cd my-solana-frontend
>npm install

The template wires up wallet connection for you, so you do not write any of it. It generates:

- src/providers.tsx — a SolanaProvider wrapping your app, with the RPC endpoint already set to devnet. This is the one place you would change the cluster.
- src/App.tsx — the connect/disconnect UI, built on the useWalletConnection hook, which discovers every Wallet-Standard wallet and returns { connectors, connect, disconnect, wallet, status }. The connected address is wallet?.account.address.

So today’s work is to run it, connect, then add a balance readout and a send button in the steps below.

2. Start the dev server and open the local URL it prints (Vite serves on http://localhost:5173 by default).
> npm run dev

3. Set your wallet to Devnet. The app itself already runs on devnet — that is the endpoint: "https://api.devnet.solana.com" in src/providers.tsx, the one place the network is configured (change it there if you ever need another cluster). Now make your wallet match: open your Phantom or Solflare extension, go into its settings, and switch the network to Devnet. A mismatch here — wallet on mainnet while the app reads devnet, or vice versa — is the single most common reason a balance reads zero.

4. Click Connect in the app, pick your wallet from the dropdown, and approve the connection request in the extension popup. The app now knows your public key.

5. Show your balance. Open src/App.tsx. Its App() function already calls useWalletConnection() and has wallet in scope. Add the useBalance hook right beside that call, then render the value where the template already shows your address.

Add the import at the top, and the hook inside App() next to the existing useWalletConnection():

>import { useBalance } from '@solana/react-hooks';
>
>// inside App(), alongside the existing hooks:
>const { lamports } = useBalance(wallet?.account.address);

Then, in the returned JSX, find the span that renders the address ({address ?? "No wallet connected"}) and drop the balance next to it:

><span className="font-mono text-xs">
>  {lamports != null ? `${Number(lamports) / 1e9} SOL` : '—'}
></span>

Copy the address and confirm it on Solana Explorer (cluster set to devnet) — the same wallet and balance you have been building up since Arc 1.

6. Wire a send flow. Still in App(), add a useSolTransfer hook and a small recipient input, then a button that calls send. This is the transaction Day 89 wraps in error handling.

Imports and hooks at the top of App() (next to the ones from Step 5):

>import { useState } from 'react';
>import { useSolTransfer } from '@solana/react-hooks';
>
>// inside App():
>const { send, isSending } = useSolTransfer();
>const [destination, setDestination] = useState('');

Then add this to the returned JSX — dropping it inside the existing wallet-connection section is a natural spot:

><div className="flex flex-wrap items-center gap-3 pt-4">
>  <input
>    value={destination}
>    onChange={(e) => setDestination(e.target.value)}
>    placeholder="Recipient address"
>    className="rounded-lg border border-border-low bg-cream px-3 py-2 font-mono text-xs"
>  />
>  <button
>    onClick={() => send({ amount: 1_000_000n, destination })}
>    disabled={isSending || !destination}
>    className="rounded-lg border border-border-low bg-card px-3 py-2 font-medium"
>  >
>    {isSending ? 'Sending…' : 'Send 0.001 SOL'}
>  </button>
></div>

Paste any devnet address into the input and click — it submits a real 0.001 SOL transfer the wallet must approve, the flow tomorrow hardens. (To call your vault’s deposit instead of a plain transfer, build the instruction with your Day 87 client and send it via the useSendTransaction hook — same shape, one instruction swapped in.)

### Run it
>npx create-solana-dapp@latest my-solana-frontend
>cd my-solana-frontend
>npm install
>npm run dev

You connected a browser wallet to a React app without writing a single line of wallet-specific integration code, and that is the whole point of the Wallet Standard. When a wallet extension loads in your browser, it announces itself on a well-defined interface that the page can read. The useWalletConnection hook from @solana/react-hooks listens for those announcements, lists whatever it finds, and once you approve, holds onto the connected account for the rest of the session. Swapping Phantom for Solflare, or adding a third wallet later, requires zero changes to your code. This is the pattern the older per-wallet adapter libraries were slowly replaced by, which is exactly why you learned it this way instead of building something you would later have to tear out.

The identity you saw in the browser is not a new one. It is the same keypair-backed account you have been reading, funding, and transacting with since the start of the program, now surfaced in a real interface. The balance on the page came from the same kind of RPC call you wrote by hand in Arc 2, except here the useBalance hook makes that call under the hood and your component renders the result. You connected the dots between an on-chain identity, a network read, and a user-facing screen.

There is one more thread worth pulling, and the next day pulls it. @solana/react-hooks also exposes hooks for sending: useSolTransfer for a plain transfer, and useSendTransaction for any instruction — including your vault’s deposit, built with the typed client you generated yesterday. Each signs with the connected wallet, the bridge between your program and a real human clicking “approve.” Tomorrow you will use one to send a transaction and, just as importantly, to handle every way a real wallet can say no.

