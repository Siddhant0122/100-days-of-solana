## Audit three Token-2022 mints and map every extension you have shipped

The moment after you finish building a database is the moment you open a SQL client and run a quick DESCRIBE on every table. You did not write the schema from memory and trust it. You confirmed the columns, the types, the constraints, and the indexes that you thought you set. It is a five minute ritual that has saved you from a thousand bad deploys.

You are three days into Token-2022, and you have shipped two distinct mints to devnet. One mint, from Day 50 and 51, carries a transfer fee. Another mint, from Day 52, carries a transfer fee stacked with interest accrual. That is a lot of behavior baked into two on-chain accounts, and so far you have only seen each extension one at a time, on the day you configured it.

Today you do the Solana equivalent of DESCRIBE. You point the spl-token CLI at each of your current mints, read back every extension the protocol sees on it, and confirm with your own eyes that the configuration you typed three days ago is the configuration that actually lives on chain. No new extensions. No new programs. Just you, reading what you built.

### Steps
#### Step 1: Open the terminal and confirm your CLI is still pointed at devnet. If you switched clusters at any point, set it back before running anything else.
#### Step 2: Find the two mint addresses from your previous days. They were printed in the terminal when you ran spl-token create-token, and they were echoed by every follow up command. If you lost them, scroll back through the terminal history or check your wallet’s devnet token list.
#### Step 3: Run spl-token display against your Day 50 mint. The CLI auto-detects that this mint lives under the Token-2022 program and prints the mint authority, the decimals, the supply, and a section listing every configured extension.
#### Step 4: Read the extensions block carefully. For the Day 50 mint you should see a TransferFeeConfig entry (with the basis points and maximum fee you set).
#### Step 5: Run spl-token display against your Day 52 mint. This is the stacked one.
#### Step 6: Read this extensions block and confirm it has everything from the Day 50 mint plus an InterestBearingConfig entry showing the annual rate in basis points and the timestamp the rate was last updated.
#### Step 7: In your text file, write one sentence per extension, in plain English, describing what that extension makes the mint do. Two sentences total. This is the reinforcement: you are forcing yourself to articulate the behavior, not just recognize the label.
#### Step 8: Take a screenshot of both display outputs side by side or stacked vertically. Highlight the extensions block on each if your screenshot tool supports it.

#### Run it
>solana config set --url https://api.devnet.solana.com

>spl-token display [YOUR_DAY_50_MINT_ADDRESS]

>spl-token display [YOUR_DAY_52_MINT_ADDRESS]

### What Just Happened
You just performed an audit of your own on-chain work, and that is a much bigger deal than it sounds. In Web2, the schema of a table lives in a database server that someone owns. You can read it if you have credentials. On Solana, the configuration of a mint lives in a single account that anyone in the world can read at any time, forever, without asking permission. The spl-token display command is not querying a private API. It is reading the same bytes that a wallet, an exchange, or a hostile auditor would read, and decoding them through the public Token-2022 layout.

Look back at what was on those two accounts. A transfer fee that the protocol enforces on every move. An interest rate that the protocol compounds for you whether anyone is watching or not. Two extensions, two accounts, zero custom programs written by you. That is the whole pitch of Token-2022 sitting in your terminal output: behaviors that used to require custom smart contracts are now configuration flags on the mint, and the configuration is public, verifiable, and impossible to silently change.

The short reflection you wrote matters more than the screenshot. The day you can describe what each extension does without looking it up is the day this arc is genuinely yours.

