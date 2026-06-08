## Group your NFTs into an on-chain collection

Yesterday you turned a single mint into a viewable NFT by stamping it with the metadata extension. Open it in Solana Explorer right now and it looks legit: a name, a symbol, a pointer to an image. But there is one thing missing that every real NFT project ships with from day one. It does not belong to anything.

In Web2 terms, you created a single row in a products table with no foreign key pointing to a category. That is fine for a one-off, but most NFTs in the wild live inside collections. The collection itself is its own row with its own name, image, and rules, and every individual NFT carries a reference back to it. Wallets, marketplaces, and explorers all read those references to group items together, show floor prices, and verify provenance.

On older Solana stacks that linkage lived inside Metaplex Token Metadata as a “collection” field. With Token Extensions there is a native, program-level way to express the same idea: the group extension marks one mint as a collection, and the member extension marks another mint as belonging to that collection. Today you are going to mint a collection, mint two member NFTs that point at it, and view the whole thing on-chain.

### Steps
The plan: one collection mint with the group extension, then two member mints that reference it. Both mints get metadata, both get zero decimals, and both eventually have their mint authorities frozen so they behave like NFTs.

#### Step 1: Confirm devnet and balance.

>solana config set --url devnet
>solana balance

If you have less than 0.2 SOL, run solana airdrop 1 first.

#### Step 2: Create the collection mint with the group extension. Token Extensions must all be declared at mint creation time, so we include both metadata and group in one shot.

>spl-token --program-id TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb create-token \
>  --decimals 0 \
>  --enable-metadata \
>  --enable-group

Copy the address printed as Creating token .... That is your COLLECTION_MINT.

#### Step 3: Stamp the collection with metadata. Replace COLLECTION_MINT with the address you just saved.

>spl-token initialize-metadata COLLECTION_MINT \
>  "Solana Sketchbook" \
>  "SKTCH" \
>  "https://gist.githubusercontent.com/janvinsha/b477ebe4dda46b0ef03895c4ea930a46/raw/f29222bcaff0d4979fe7ebb610a00bb97a8418ec/collection.json"

#### Step 4: Initialize the group. The second argument is the maximum collection size. Pick 3 so you have room to expand later this week.

>spl-token initialize-group COLLECTION_MINT 3

#### Step 5: Create the first member mint. Same idea as step 2, but with --enable-member instead of --enable-group.

>spl-token --program-id TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb create-token \
>  --decimals 0 \
>  --enable-metadata \
>  --enable-member

Save this address as MEMBER_ONE_MINT.

#### Step 6: Stamp the first member with its own metadata.

>spl-token initialize-metadata MEMBER_ONE_MINT \
>  "Sketch #1" \
>  "SK1" \
>  "https://gist.githubusercontent.com/janvinsha/3412c5d4e92b6de9a2ed82337ecafc44/raw/99359fc62ffd0480b6a52ee1ad4048ecba4ae61c/nft.json"

#### Step 7: Link the member to the collection. The first positional argument is the member mint, the second is the group mint. This is the line that wires the two together on-chain.

>spl-token initialize-member MEMBER_ONE_MINT COLLECTION_MINT

#### Step 8: Mint exactly one of the first NFT and lock supply.

>spl-token create-account MEMBER_ONE_MINT
>spl-token mint MEMBER_ONE_MINT 1
>spl-token authorize MEMBER_ONE_MINT mint --disable

#### Step 9: Repeat steps 5 through 8 for a second member NFT. Use "Sketch #2" and symbol "SK2". Save the address as MEMBER_TWO_MINT.

#### Step 10: View the collection on Solana Explorer. Open three tabs:

>https://explorer.solana.com/address/COLLECTION_MINT?cluster=devnet
>https://explorer.solana.com/address/MEMBER_ONE_MINT?cluster=devnet
>https://explorer.solana.com/address/MEMBER_TWO_MINT?cluster=devnet

On the collection mint, scroll to the Extensions panel. You should see Group with size: 2 and max_size: 3. On each member mint, look for the Group Member extension and confirm the group address matches your collection mint.

Run it
>spl-token display COLLECTION_MINT
>spl-token display MEMBER_ONE_MINT
>spl-token display MEMBER_TWO_MINT

The display output prints every extension on each mint. On the collection you will see the group entry with the current member count. On the members you will see the group member entry with the collection address and the member number.

