// Pays this app's x402 route, the way an agent would, and prints the proof.
//
//   npm run chain                  (terminal 1) a local fork of Base Sepolia on anvil
//   X402_LOCAL_RPC=http://127.0.0.1:8545 npm run dev   (terminal 2) the app, settling against that fork
//   npm run pay -- --local         (terminal 3) gives anvil's second dev account 10 test USDC, then pays
//
//   PAYER_KEY=0x… npm run pay      Base Sepolia: a THROWAWAY test wallet holding test USDC (https://faucet.circle.com)
//
// Options: --url <address of the paid route> (default http://localhost:3000/api/x402/hello).

import { x402Client } from "@x402/core/client";
import { toClientEvmSigner } from "@x402/evm";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { decodePaymentResponseHeader, wrapFetchWithPayment } from "@x402/fetch";
import { createPublicClient, encodeAbiParameters, http, keccak256, parseAbi } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";

const USDC = "0x036CbD53842c5426634e7929541eC2318f3dCF7e"; // Circle's test USDC on Base Sepolia
const ANVIL_PAYER_KEY = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d"; // anvil's second dev account
const args = process.argv.slice(2);
const local = args.includes("--local");
const at = args.indexOf("--url");
const url = at >= 0 ? args[at + 1] : "http://localhost:3000/api/x402/hello";
const rpc = local ? "http://127.0.0.1:8545" : "https://sepolia.base.org";

const key = local ? ANVIL_PAYER_KEY : process.env.PAYER_KEY;
if (!key) throw new Error("Set PAYER_KEY to a throwaway Base Sepolia test wallet's key, or use --local with anvil.");
const account = privateKeyToAccount(key);
const chain = createPublicClient({ chain: baseSepolia, transport: http(rpc) });
const usdc = parseAbi(["function balanceOf(address) view returns (uint256)"]);
const balance = (a) => chain.readContract({ address: USDC, abi: usdc, functionName: "balanceOf", args: [a] });

if (local) {
  // Test USDC keeps balances in storage slot 9 (mapping address => balance); write 10 USDC straight into it.
  const slot = keccak256(encodeAbiParameters([{ type: "address" }, { type: "uint256" }], [account.address, 9n]));
  await chain.request({ method: "anvil_setStorageAt", params: [USDC, slot, `0x${(10_000_000n).toString(16).padStart(64, "0")}`] });
}

const client = new x402Client();
registerExactEvmScheme(client, { signer: toClientEvmSigner(account, chain) });
const pay = wrapFetchWithPayment(fetch, client);

const before = await balance(account.address);
const res = await pay(url);
const body = await res.text();
console.log(`${res.status} ${body}`);
const header = res.headers.get("PAYMENT-RESPONSE");
if (!header) process.exit(res.ok ? 0 : 1);
const settled = decodePaymentResponseHeader(header);
const after = await balance(account.address);
console.log(`paid ${Number(before - after) / 1e6} USDC from ${account.address}`);
console.log(`transaction ${settled.transaction} on ${settled.network}`);
process.exit(res.ok ? 0 : 1);
