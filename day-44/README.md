## Give your NFT a name, an image, and on-chain metadata

Yesterday you created a 1-of-1 token on devnet. Mechanically it is an NFT: supply of one, zero decimals, mint authority burned. But if you opened it in a wallet right now you would see a blank tile with no name, no picture, no description. Nothing that signals what the token represents. In Web2 terms, you provisioned the database row but left every column null.

Real NFTs carry a payload. A name, a symbol, a pointer to an image, a list of traits, sometimes a description. In the older Solana world that payload lived in a separate program called Metaplex Token Metadata, which created its own account next to your mint. With Token Extensions, that data can sit directly on the mint account itself using two extensions that work as a pair: the metadata pointer extension says “this mint’s metadata lives at address X,” and the metadata extension stores the actual fields. Today you are going to use them together to turn yesterday’s empty token into a viewable NFT that shows up correctly in Solana Explorer and most modern wallets.

### Steps:
#### Step 1: Confirm your CLI is pointed at devnet and check your balance:
>solana config set --url https://api.devnet.solana.com
>solana balance

#### Step 2: Pick or upload an image. The simplest option is to find any PNG already hosted on the open web and copy its direct URL. For your first pass, a placeholder is fine. You can swap it later. Keep the URL handy.
#### Step 3: Create your off-chain metadata JSON. Open a new GitHub Gist, name the file metadata.json, and paste in the following, replacing the values to describe your own NFT:
>{
>  "name": "First Light",
>  "symbol": "LIGHT",
>  "description": "My first real NFT, minted on Solana devnet during 100 Days of Solana.",
>  "image": "https://upload.wikimedia.org/wikipedia/commons/4/49/Dichroic_filters.jpg",
>  "attributes": [
>    { "trait_type": "Filters", "value": "44" },
>    { "trait_type": "Network", "value": "Devnet" }
>  ]
>}

Save the gist as public, then click the Raw button. Copy that raw URL. It should start with https://gist.githubusercontent.com/ and end in metadata.json. This is your metadata URI.
#### Step 4: Generate a vanity-friendly mint keypair so you can read the mint address easily:
>solana-keygen grind --starts-with nft:1

This produces a JSON file in your current directory like nftXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX.json. Note the mint address (the file name without .json).

#### Step 5:Create the mint with the metadata extension turned on. The Token Extensions program ID is TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb:
>spl-token create-token \
>  --program-id TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb \
>  --enable-metadata \
>  --decimals 0 \
>  ./nftXXXX...XXXX.json

Replace the path with the actual file produced in step 4. The --enable-metadata flag wires up both the metadata pointer (pointing the mint at itself) and reserves space for metadata fields on the mint account.

#### Step 6: Initialize the on-chain metadata fields. The arguments are mint name symbol uri:
>spl-token initialize-metadata \
>  [YOUR_MINT_ADDRESS] \
>  "First Light" \
>  "LIGHT" \
>  [YOUR_GIST_RAW_URL]

Substitute your actual mint address and the raw gist URL from step 3. After this transaction confirms, the mint account itself stores the name, symbol, and URI.

#### Step 7: Create your associated token account and mint exactly one unit:
>spl-token create-account [YOUR_MINT_ADDRESS]
>spl-token mint [YOUR_MINT_ADDRESS] 1

#### Step 8: Lock the supply forever by disabling the mint authority, the same move you made yesterday:
>spl-token authorize [YOUR_MINT_ADDRESS] mint --disable

#### Step 9: Open Solana Explorer (devnet), paste your mint address into the search bar, and look at the token page. You should see your name, symbol, the image rendered from the JSON, and the attributes listed.
Run it
>spl-token display [YOUR_MINT_ADDRESS]

You should see fields like Mint, Supply: 1, Decimals: 0, Mint authority: (not set), plus a metadata block listing your name, symbol, and URI.

