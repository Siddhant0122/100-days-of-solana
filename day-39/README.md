## Inspect and Compare Token Extension Configurations

In Web2 development, when you inherit a codebase or join a new team, one of your first tasks is reading configuration files. You open the package.json, the environment variables, the database schema. You do not start changing things until you understand what is already there. Reading and interpreting existing configuration is a core skill that separates developers who break things from developers who improve things.

Over the past three days, you created three different token mints on Solana, each with different extensions: an interest-bearing token, a multi-extension token combining transfer fees with metadata, and a compliance-gated token with a default frozen account state. Today you are going to slow down and reinforce what you learned by inspecting each of those mints using the CLI, comparing their on-chain data, and mapping the output back to the extension parameters you configured. This is the Solana equivalent of reading configuration files before writing new code.

### Steps
#### Step 1: Inspect your interest-bearing mint from Day 36

Use the spl-token display command to pull the full on-chain state of your interest-bearing token mint. This command reads the account data and decodes the extensions for you.

>spl-token display [YOUR_INTEREST_BEARING_MINT_ADDRESS] --program-id TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb

Look at the output. You should see a section labeled “Extensions” that includes the interest-bearing configuration. Note the following fields:

Rate authority: the address that can update the interest rate
Current rate: the rate you set when you created the mint (in basis points)
Write down the current rate value. Remember, this extension does not mint new tokens. It provides a calculation layer so wallets and applications can display an adjusted balance based on elapsed time.

#### Step 2: Inspect your multi-extension mint from Day 37

>spl-token display [YOUR_MULTI_EXTENSION_MINT_ADDRESS] --program-id TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb
This time the Extensions section should show multiple entries. Look for:

TransferFeeConfig: shows the fee in basis points and the maximum fee
MetadataPointer: shows the authority and the address where metadata lives
Metadata: shows the name, symbol, and URI you set
Notice how each extension occupies its own block in the output. Extensions are stored sequentially in the mint account’s data, and the CLI parses each one separately.

#### Step 3: Inspect your default-frozen mint from Day 38

>spl-token display [YOUR_FROZEN_MINT_ADDRESS] --program-id TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb
Here you should see:

Freeze authority: an address (yours) that can thaw accounts
DefaultAccountState: listed under Extensions, showing “Frozen” as the default state

#### Step 4: Compare account sizes

Each extension adds data to the mint account, which means each mint requires a different amount of rent-exempt storage. Run the following command for each of your three mints to see their account sizes:

>solana account [MINT_ADDRESS] --output json | grep -o '"space":[ ]*[0-9]*' | grep -o '[0-9]*$'
Alternatively, note the “Data Length” field when you run:

>solana account [MINT_ADDRESS]
Record the data length for each mint. You should observe that:

The interest-bearing mint (one extension) has the smallest data footprint
The multi-extension mint (transfer fees + metadata) is larger
The default-frozen mint may be similar in size to the interest-bearing one, since DefaultAccountState adds minimal data
This difference matters because larger accounts cost more SOL in rent-exempt deposits. When you design a token, the extensions you choose have a direct cost implication.

#### Step 5: Create a comparison table

In a text file, markdown document, or notebook, create a table with the following columns:

Mint address
Extensions enabled
Account data size (bytes)
Rent cost (SOL)
Key authorities (mint authority, freeze authority, rate authority, transfer fee authority)
Fill in each row with the data you collected. This table is your reference sheet for understanding how extension choices translate to on-chain costs and governance requirements.

Run it
If you no longer have your mint addresses from the previous days, you can create fresh examples to inspect. Here is a quick way to create a minimal interest-bearing mint for inspection:

>spl-token create-token --program-id TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb --interest-rate 500

And a minimal default-frozen mint:
>spl-token create-token --program-id TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb --enable-freeze --default-account-state frozen

Then run spl-token display on each to compare their extension output.

# Token-2022 Mint Comparison Table

| Field | Day 36 — Interest-Bearing | Day 37 — Multi-Extension (ArcCoin) | Day 38 — Default-Frozen |
|---|---|---|---|
| **Mint Address** | `GeRroBpB1...pbF6p` | `CX7vefHyu...LfWL` | `KX51Ac5tu...BaoD` |
| **Program** | Token-2022 | Token-2022 | Token-2022 |
| **Name / Symbol** | — | ArcCoin / ARC | — |
| **Supply (raw)** | 1,000,000,000,000 | 100,000 | 100,000,000,000 |
| **Decimals** | 9 | 2 | 9 |
| **Adjusted Supply** | 1,000 tokens | 1,000 tokens | 100 tokens |
| **Extensions** | Interest-Bearing | Interest-Bearing, Transfer Fees, Metadata Pointer, Metadata | Default Account State |
| **Current Interest Rate** | 15,000 bps (150%) | 5 bps (0.05%) | — |
| **Average Interest Rate** | 500 bps (5%) | 5 bps (0.05%) | — |
| **Transfer Fee** | — | 100 bps (1%) | — |
| **Max Transfer Fee** | — | 50,000 (raw units) | — |
| **Withheld Fees** | — | 0 | — |
| **Default Account State** | Initialized | Initialized | **Frozen** |
| **Metadata URI** | — | [opos-asset JSON](https://raw.githubusercontent.com/solana-developers/opos-asset/main/assets/CompressedCoil/metadata.json) | — |
| **Mint Authority** | `DK93PCwc...3f2r` | `DK93PCwc...3f2r` | `DK93PCwc...3f2r` |
| **Freeze Authority** | (not set) | (not set) | `DK93PCwc...3f2r` |
| **Rate Authority** | `DK93PCwc...3f2r` | `DK93PCwc...3f2r` | — |
| **Transfer Fee Authority** | — | `DK93PCwc...3f2r` | — |
| **Metadata Authority** | — | `DK93PCwc...3f2r` | — |
| **Est. Account Size** | ~234 bytes | ~400+ bytes | ~234 bytes |
| **Est. Rent Cost** | ~0.0016 SOL | ~0.003+ SOL | ~0.0016 SOL |

## Key Observations

- **Interest-Bearing mint** — simplest extension; rate is set in bps but no new tokens are ever minted. Wallets use elapsed time + rate to compute a *display* balance only.
- **Multi-Extension mint (ArcCoin)** — most complex: combines interest, a 1% transfer fee with on-chain metadata. Each extension adds bytes → higher rent.
- **Default-Frozen mint** — every new token account created for this mint starts in a Frozen state; the mint authority must explicitly thaw before the user can transact.

> **Note:** Run `solana account <MINT_ADDRESS>` to get the exact `Data Length` and use `solana rent <BYTES>` to calculate precise rent cost for each mint.
