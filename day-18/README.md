## Add transaction confirmation UI

Yesterday I built a programmatic transfer tool. It takes a recipient address and an amount from the command line, sends SOL on devnet, and prints a transaction signature. It even waits for the transaction to be confirmed before moving on. But that confirmation happens in a single opaque step: you call sendAndConfirm, it hangs for a moment, and then you get a signature. You have no visibility into the stages in between, and if anything goes wrong the error lands as an unhandled rejection.

### Steps
#### Step 1: Understand what confirmation actually means

When you send a transaction on Solana, it does not go from “pending” to “done” in one jump. It moves through three commitment levels:

Processed: A validator included your transaction in a recent block. Think of this like your POST request reaching the server. The server acknowledged it, but nothing is guaranteed yet.
Confirmed: A supermajority of validators (66%+) voted on the block containing your transaction. This is like getting a 200 OK from a load-balanced API where most backend nodes agree the write succeeded. In Solana’s entire history, no confirmed transaction has ever been reversed.
Finalized: At least 31 additional confirmed blocks have been built on top of yours. This is the equivalent of a database commit that has been replicated, flushed to disk, and backed up. It is irreversible.

#### Step 2: Swap the all-in-one factory for a manual send + poll

Yesterday’s tool used sendAndConfirmTransactionFactory, which bundles sending the transaction and waiting for confirmation into one call. That is convenient, but it gives you no hook to report progress between stages. Today you split it apart: send the transaction yourself, then poll the network for its status as it climbs the commitment ladder.