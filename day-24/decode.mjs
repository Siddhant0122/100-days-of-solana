// This file fetches the Wrapped SOL mint account and decodes it three ways:
//
// 1. Raw bytes from base64 account data
// 2. Token Program Mint codec
// 3. Manual byte-level parsing with DataView
// 4. RPC jsonParsed output
//
// The important result: all decoded views should agree on the same core fields.

import {
    createSolanaRpc,
    address,
    getBase64Encoder,
    getBase16Decoder,
    getBase58Decoder,
} from "@solana/kit";

import { getMintDecoder } from "@solana-program/token";

const rpc = createSolanaRpc("https://api.mainnet-beta.solana.com");

// Wrapped SOL mint address.
const mintAddress = address("So11111111111111111111111111111111111111112");

// -----------------------------------------------------------------------------
// 1. Fetch raw account data
// -----------------------------------------------------------------------------

const {value: accountInfo} = await rpc
    .getAccountInfo(mintAddress, {encoding: "base64"})
    .send();

if(!accountInfo){
    throw new Error("Account not found");
}

// With base64 encoding, accountInfo.data is returned as:
//
//   [base64String, "base64"]
//
// Convert the base64 string back into the raw bytes stored in the account.
const dataBytes = getBase64Encoder().encode(accountInfo.data[0]);

console.log("--- Raw Account Data ---");
console.log("Owner program:", accountInfo.owner);
console.log("Data length:", dataBytes.length, "bytes");
console.log("Raw data (hex):", getBase16Decoder().decode(dataBytes));

// -----------------------------------------------------------------------------
// 2. Decode with the Token Program Mint codec
// -----------------------------------------------------------------------------

const mintDecoder = getMintDecoder();
const mint = mintDecoder.decode(dataBytes);

const codecMintAuthority = mint.freezeAuthority.__option === "Some" ? mint.mintAuthority.value: "None";

const codecFreezeAuthority = mint.freezeAuthority.__option === "Some" ? mint.freezeAuthority.value: "None";

console.log("\n--- Decoded With Token Program Codec ---");
console.log("Mint Authority:", codecMintAuthority);
console.log("Supply:", mint.supply.toString());
console.log("Decimals:", mint.decimals);
console.log("Is Initialized:", mint.isInitialized);
console.log("Freeze Authority:", codecFreezeAuthority);

// -----------------------------------------------------------------------------
// 3. Decode manually with DataView
// -----------------------------------------------------------------------------

console.log("\n--- Manual Byte-Level Decode ---");

const view = new DataView(
    dataBytes.buffer,
    dataBytes.byteOffset,
    dataBytes.byteLength
);

const base58Decoder = getBase58Decoder();

// SPL Token Mint account layout:
//
// Bytes 0-3:   mintAuthorityOption, u32, little-endian
// Bytes 4-35:  mintAuthority, 32-byte public key
// Bytes 36-43: supply, u64, little-endian
// Byte 44:     decimals, u8
// Byte 45:     isInitialized, boolean as u8
// Bytes 46-49: freezeAuthorityOption, u32, little-endian
// Bytes 50-81: freezeAuthority, 32-byte public key

const hasMintAuthority = view.getUint32(0, true) === 1;

let manualMintAuthority = "None";

if(hasMintAuthority){
    const authorityBytes = dataBytes.slice(4,36);
    manualMintAuthority = base58Decoder.decode(authorityBytes);
}

const manualSupply = view.getBigUint64(36, true);
const manualDecimals = view.getUint8(44);
const manualIsInitialized = view.getUint8(45) === 1;

const hasFreezeAuthority = view.getUint32(46, true) === 1;

let manualFreezeAuthority = "None";

if(hasFreezeAuthority){
    const freezeAuthorityBytes = dataBytes.slice(50,82);
    manualFreezeAuthority = base58Decoder.decode(freezeAuthorityBytes);
}

console.log("Mint Authority:", manualMintAuthority);
console.log("Supply:", manualSupply.toString());
console.log("Decimals:", manualDecimals);
console.log("Human-readable supply:", Number(manualSupply) / Math.pow(10, manualDecimals));
console.log("Is Initialized:", manualIsInitialized);
console.log("Freeze Authority:", manualFreezeAuthority);

// -----------------------------------------------------------------------------
// 4. Compare with RPC jsonParsed
// -----------------------------------------------------------------------------

const parsed = await rpc
    .getAccountInfo(mintAddress, {encoding: "jsonParsed"})
    .send();

if(!parsed.value){
    throw new Error("Account not found from jsonParsed request");
}

const parsedData = parsed.value.data.parsed;
const mintInfo = parsedData.info;

console.log("\n--- RPC jsonParsed Result ---");
console.log("Program:", parsedData.program);
console.log("Account Type:", parsedData.type);
console.log("Mint Authority:", mintInfo.mintAuthority ?? "None");
console.log("Supply:", mintInfo.supply);
console.log("Decimals:", mintInfo.decimals);
console.log("Is Initialized:", mintInfo.isInitialized);
console.log("Freeze Authority:", mintInfo.freezeAuthority ?? "None");

// -----------------------------------------------------------------------------
// 5. Final comparison
// -----------------------------------------------------------------------------

console.log("\n--- Do They Match? ---");

console.log("Codec Supply:", mint.supply.toString());
console.log("Manual Supply:", manualSupply.toString());
console.log("RPC Parsed Supply:", mintInfo.supply);

console.log("\nCodec Decimals:", mint.decimals);
console.log("Manual Decimals:", manualDecimals);
console.log("RPC Parsed Decimals:", mintInfo.decimals);

console.log("\nCodec Mint Authority:", codecMintAuthority);
console.log("Manual Mint Authority:", manualMintAuthority);
console.log("RPC Parsed Mint Authority:", mintInfo.mintAuthority ?? "None");

console.log("\nCodec Freeze Authority:", codecFreezeAuthority);
console.log("Manual Freeze Authority:", manualFreezeAuthority);
console.log("RPC Parsed Freeze Authority:", mintInfo.freezeAuthority ?? "None");