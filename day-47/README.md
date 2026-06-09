## Mutate your NFT's metadata live on devnet

That is a lot of careful work. Now it is time to break the careful posture for a day and just poke at things.

In your Web2 life, this is the part where you would open a staging database, run a few UPDATE statements, and refresh the admin panel to see what happens. You would change a user’s display name. You would flip a feature flag. You would add a new column and watch how the UI reacts. The point is not to ship anything. The point is to build intuition by touching the thing.

Today you are going to do the on-chain equivalent. Your NFT has metadata sitting inside the mint account. That metadata is mutable as long as you hold the update authority, which you do. So you are going to rename it, change the image it points to, invent a custom field nobody asked for, and then delete that field a minute later. Each change is a single CLI call. Each change shows up in Solana Explorer the moment the transaction confirms.

This is the day you stop treating your NFT like a fragile artifact and start treating it like a living row of data on a public network.

Steps
1. Make sure your Solana CLI is pointed at devnet by running solana config set --url https://api.devnet.solana.com. Confirm with solana config get.
2. Open your NFT in Solana Explorer. Paste the mint address into the search bar and scroll down to the Token Extensions panel. Find the Token Metadata extension. Note the current name, symbol, URI, and any additional metadata fields. Keep this tab open. You will come back to it after every change.
3. Pick a new name for your NFT. Anything you want. "Field Notes". "Devnet Original". "Probably Worthless". Run the rename command shown in the Run it section below, substituting your mint address.
4. Refresh the Explorer tab. The name field should reflect your change within a few seconds. If it does not, give it a beat. Devnet RPC nodes occasionally lag a slot or two behind.
5. Now invent a custom field. The metadata extension lets you store arbitrary key/value pairs in the additional_metadata array. Add one called rarity with the value legendary. Or vibe, chaotic-good. Or edition, field-test-1. The point is the schema is open.
6. Refresh Explorer again. Scroll down to the Token Metadata extension and look for your new key under additional metadata. There it is, on chain, on a public network, queryable by anyone with an RPC endpoint.
7. Change your mind. Remove the custom field you just added by passing the --remove flag. Refresh Explorer. Watch it disappear.
8. Finally, swap the image. Find any publicly hosted image you have rights to use, get its raw URL, build a new metadata JSON file that points at it, host the JSON somewhere public (a GitHub gist with the raw URL works), and update the uri field on the mint to point at the new JSON.
9. Open a wallet like Phantom or Backpack on devnet and import or send the NFT to a wallet you control. See whether the new image shows up. Wallets cache aggressively, so this is also a lesson in how the off-chain image layer behaves differently from the on-chain metadata layer.

Run it

Update the name field:
>spl-token update-metadata [MINT_ADDRESS] name "Field Notes"

Add a custom additional metadata field:
>spl-token update-metadata [MINT_ADDRESS] rarity legendary

Remove that custom field:
>spl-token update-metadata [MINT_ADDRESS] rarity --remove

Point the NFT at a new metadata JSON:
>spl-token update-metadata [MINT_ADDRESS] uri https://gist.githubusercontent.com/janvinsha/6f8187a0b15de99c03a1b07e82db36e9/raw/83e33a3529d07df1f4d60bf7d543c5b72b5314e2/metadata.json
