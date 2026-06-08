## Audit your NFT collection on chain

The past three days have been a whirlwind. You minted a 1-of-1 token, you stamped metadata directly onto the mint with the Metadata extension, and you wrapped the whole thing inside a collection using the Group and Member extensions. In your head, you know each piece is on Solana. But how do you actually see it?

In your Web2 life, after running a migration or seeding a database, you would not just trust that the rows are there. You would open a database client, query the table, and eyeball the structure. You would check that foreign keys actually point at the right parent rows. You would compare two records side by side to make sure the schema applied consistently.

Today you do the Solana equivalent. You are going to read your NFT and your collection back from devnet, inspect every extension you attached, and confirm that the link between the member NFT and its parent collection is exactly what you think it is. No new minting. No new code. Just a careful look at what is already there, the way a senior engineer reviews their own work before shipping.

### Steps
#### Step 1: Confirm your devnet setup. Make sure your CLI is talking to devnet so any commands against your mints resolve correctly.

>solana config set --url https://api.devnet.solana.com
>solana config get

#### Step 2: Display your member NFT. Use the spl-token display command on the mint address of the NFT you built on Day 44. Replace YOUR_NFT_MINT with that address.

>spl-token display YOUR_NFT_MINT

Look closely at the output. You should see:
Supply: 1
Decimals: 0
Mint authority: (not set) because you burned it on Day 43
An Extensions section listing MetadataPointer, TokenMetadata, and GroupMemberPointer (plus TokenGroupMember if you stored member data on the mint itself)
The Name, Symbol, and URI you set on Day 44

#### Step 3: Display your collection NFT. Run the same command against your collection mint from Day 45.
>spl-token display YOUR_COLLECTION_MINT

This time you should see GroupPointer and TokenGroup in the extensions list, along with a Max size and an Update authority for the group.

#### Step 4: Verify the parent reference. Inside the TokenGroupMember data on your member NFT, find the Group address. It should equal your collection mint address byte-for-byte. This is the equivalent of a foreign key resolving correctly between two rows.

#### Step 5: View both on Solana Explorer. Open Solana Explorer, make sure the cluster dropdown shows Devnet, and paste in your member mint address. Click around the page and find:

- The Token Extensions panel listing every extension on the mint
- The Metadata section rendering your token’s name and image
- A link or address pointing back to the collection mint
Repeat for the collection mint address.
#### Step 6: Compare with an old fungible mint. If you still have any mint address from the SPL Token weeks, run spl-token display on it too. Notice what is missing: no Extensions block with metadata, no group pointer, decimals greater than zero, supply larger than one. This contrast is the clearest way to see what makes an NFT an NFT on Solana.

Run it
>solana config set --url https://api.devnet.solana.com
>spl-token display YOUR_NFT_MINT
>spl-token display YOUR_COLLECTION_MINT