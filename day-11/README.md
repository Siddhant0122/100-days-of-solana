# What You’ll Need   
A terminal with the Solana CLI installed  
Your Solana CLI configured to devnet (solana config set --url https://api.devnet.solana.com)  
A devnet wallet with some SOL (run solana airdrop 2 if needed)  
A text editor or notes app for your comparison table  
  
Inspect your own wallet account  
  
Every wallet on Solana is an account. Let’s look at yours. Run the following command to get your wallet’s public key:  
  
>>>solana address 
  
Now inspect that account:
  
>>>solana account $(solana address)  
  
In a traditional database, user record might live in a users table with columns like id, balance, and email. On Solana, this account is “row,” but instead of living in a table that a single server controls, it lives on a global ledger that thousands of validators maintain together.  
  
Inspect a program account  
  
Now look at something executable. The Token Program manages all SPL tokens on Solana. Inspect it:  
  
>>>solana account TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA  
  
Notice the differences: the executable field is true, and the owner is the BPF Loader. This account stores compiled program code, not user data. In Web2 terms, this is like the application binary that lives on your server, while your wallet was like a record in a database. On Solana, both code and data live in the same account model, not separate systems.  
  
  
| Concept | Traditional Database | Solana Accounts |
|---|---|---|
| Data location | Rows in tables on a centralized server | Accounts on a distributed ledger across validators |
| Schema | Defined by the database (SQL DDL, document schema) | Defined by the owning program; stored as raw bytes in the account's `data` field |
| Access control | Application-level auth (SQL roles, app middleware) | Enforced by the runtime: only the owning program can modify an account, and only with the required signer(s) |
| Cost of storage | Server/cloud hosting fees, pay for disk space | Rent-exempt deposit proportional to data size (query via `solana rent`); refundable when the account is closed |
| Identity / keys | Auto-increment IDs, UUIDs | 32-byte public keys or Program Derived Addresses (PDAs) |
| Reads | SQL queries, document lookups | RPC calls (`getAccountInfo`, `getProgramAccounts`) |
| Writes | INSERT/UPDATE via application code | Transactions with instructions, signed by authorized keys |
| Code vs data | Application code and database are separate systems | Both are accounts; programs (code) and data accounts coexist in the same model |
| Deletion | DELETE query removes the row | Close the account; lamports are returned to you |
| Visibility | Private by default; you choose what to expose | Public by default; anyone can read any account's data |
  
  
In a database, storage costs are part of your hosting bill. On Solana, storage costs are explicit: you deposit lamports proportional to the size of the data you want to store. This deposit is fully refundable when you close the account.
  
Check how much it costs to store different amounts of data:  
  
>>>solana rent 0  
>>>solana rent 100  
>>>solana rent 1000  
  
The solana rent command uses the getMinimumBalanceForRentExemption RPC method under the hood. Notice how the cost scales linearly with data size. Compare that to traditional databases where storage cost is abstracted into infrastructure pricing rather than attached directly to each record.
  
