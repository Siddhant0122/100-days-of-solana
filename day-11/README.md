# What You’ll Need <br>
A terminal with the Solana CLI installed<br>
Your Solana CLI configured to devnet (solana config set --url https://api.devnet.solana.com)<br>
A devnet wallet with some SOL (run solana airdrop 2 if needed)<br>
A text editor or notes app for your comparison table<br>
<br>
Inspect your own wallet account<br>
<br>
Every wallet on Solana is an account. Let’s look at yours. Run the following command to get your wallet’s public key:<br>
<br>
>>>solana address
<br>
Now inspect that account:
<br>
>>>solana account $(solana address)<br>
<br>
In a traditional database, user record might live in a users table with columns like id, balance, and email. On Solana, this account is “row,” but instead of living in a table that a single server controls, it lives on a global ledger that thousands of validators maintain together.<br>
<br>
Inspect a program account<br>
<br>
Now look at something executable. The Token Program manages all SPL tokens on Solana. Inspect it:<br>
<br>
solana account TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA<br>
<br>
Notice the differences: the executable field is true, and the owner is the BPF Loader. This account stores compiled program code, not user data. In Web2 terms, this is like the application binary that lives on your server, while your wallet was like a record in a database. On Solana, both code and data live in the same account model, not separate systems.<br>
<br>
<br>
| Concept | Traditional Database | Solana Accounts |
|----------|----------------------|-----------------|
| Data location | Rows in tables <br> on a centralized server | Accounts on a distributed ledger <br> across validators |
| Schema | Defined by the database <br> (SQL DDL, document schema) | Defined by the owning program <br> stored as raw bytes in the account’s `data` field |
| Access control | Application-level auth <br> (SQL roles, app middleware) | Enforced by the runtime <br> only the owning program can modify an account <br> and only with the required signer(s) |
| Cost of storage | Server/cloud hosting fees <br> pay for disk space | Rent-exempt deposit proportional to data size <br> query via `solana rent` <br> refundable when the account is closed |
| Identity/keys | Auto-increment IDs <br> UUIDs | 32-byte public keys <br> or Program Derived Addresses (PDAs) |
| Reads | SQL queries <br> document lookups | RPC calls <br> (`getAccountInfo`, `getProgramAccounts`) |
| Writes | INSERT/UPDATE <br> via application code | Transactions with instructions <br> signed by authorized keys |
| Code vs data | Application code and database <br> are separate systems | Both are accounts <br> programs (code) and data accounts <br> coexist in the same model |
| Deletion | DELETE query <br> removes the row | Close the account <br> lamports are returned to you |
| Visibility | Private by default <br> you choose what to expose | Public by default <br> anyone can read any account’s data |
<br>
<br>
In a database, storage costs are part of your hosting bill. On Solana, storage costs are explicit: you deposit lamports proportional to the size of the data you want to store. This deposit is fully refundable when you close the account.
<br>
Check how much it costs to store different amounts of data:<br>
<br>
>>>solana rent 0<br>
>>>solana rent 100<br>
>>>solana rent 1000<br>
<br>
The solana rent command uses the getMinimumBalanceForRentExemption RPC method under the hood. Notice how the cost scales linearly with data size. Compare that to traditional databases where storage cost is abstracted into infrastructure pricing rather than attached directly to each record.
<br>
