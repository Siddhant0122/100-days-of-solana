## Mint a 1-of-1 SPL token and meet your first NFT

For the past few weeks you have lived inside the SPL Token world. You minted fungible tokens, attached transfer fees, frozen accounts by default, and stamped metadata directly onto mints with token extensions. You can read a mint configuration like a database schema. Today the curtain pulls back on a small secret: the NFTs everyone talks about, the kind that show up in marketplaces and profile pictures, are built on the very same plumbing you have been using.

In Web2 you might think of an NFT as a unique row in a database with an immutable history of who owned it and when. On Solana, the simplest possible version of that idea is a token mint where the supply is exactly one and the smallest unit cannot be subdivided. No fractional shares. No second copy. One token, one owner, forever. That is the seed of every NFT you have ever seen, and today you are going to plant it yourself using only the tools you already have installed.

Steps
1. Confirm your CLI is pointed at devnet and that you have some SOL to pay rent and fees. If anything looks off, airdrop yourself a little more SOL before continuing.
2. Create a new token mint with zero decimals. Zero decimals means the token has no fractional units, which is the first half of “non-fungible.” Save the mint address that the command prints; you will need it in every step that follows.
3. Create an associated token account for that mint under your wallet. This is the box that will hold your single token.
4. Mint exactly one token into that account. After this command runs, the total supply of this mint on the entire Solana network will be one.
5. Disable the mint authority. This is the second half of “non-fungible.” With no mint authority, nobody, not even you, can ever create a second copy. The supply is locked at one for all time.
6. Open Solana Explorer, paste in your mint address, and look at how the page describes it. Take a screenshot of the explorer page showing your new NFT.
Run it
>solana config set --url https://api.devnet.solana.com
>solana balance
>spl-token create-token --decimals 0
>spl-token create-account [YOUR_MINT_ADDRESS]
>spl-token mint [YOUR_MINT_ADDRESS] 1
>spl-token authorize [YOUR_MINT_ADDRESS] mint --disable
>spl-token supply [YOUR_MINT_ADDRESS]
