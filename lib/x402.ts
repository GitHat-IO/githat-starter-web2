// Pay per call (x402 v2, the x402 Foundation's own packages: @x402/core, @x402/evm, @x402/next).
//
// Where payments are checked and settled (the "facilitator"):
//  - CDP_API_KEY_ID + CDP_API_KEY_SECRET set: Coinbase's CDP facilitator, which also screens each payment (KYT/OFAC).
//    That is the one to use on Base mainnet.
//  - X402_LOCAL_RPC=http://127.0.0.1:8545: checked and settled in this process against a local anvil fork of Base
//    Sepolia (`npm run chain`), anvil's first dev account paying the gas. Only a localhost address is accepted.
//  - otherwise X402_FACILITATOR_URL, else https://x402.org/facilitator, which serves TEST networks only.
// The network defaults to Base Sepolia (a test network: the money has no value). Going live is a deliberate setting:
// X402_NETWORK=eip155:8453 (Base) together with the CDP keys.

import { createCdpFacilitatorClient } from "@coinbase/cdp-sdk/x402";
import { x402Facilitator } from "@x402/core/facilitator";
import { HTTPFacilitatorClient, x402ResourceServer, type FacilitatorClient } from "@x402/core/server";
import { toFacilitatorEvmSigner } from "@x402/evm";
import { ExactEvmScheme as ExactEvmFacilitator } from "@x402/evm/exact/facilitator";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { createWalletClient, http, publicActions } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";

export const BASE_SEPOLIA = "eip155:84532";
export const BASE = "eip155:8453";
export const TEST_FACILITATOR = "https://x402.org/facilitator";
/** Anvil's first dev account: a key printed by every anvil, holding only local test ETH. Never use it on a real network. */
export const ANVIL_FACILITATOR_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

type Env = Record<string, string | undefined>;
type Network = `${string}:${string}`;

/** The network payments are taken on (CAIP-2). */
export function x402Network(env: Env = process.env): Network {
  const n = env.X402_NETWORK?.trim();
  return (n && /^eip155:\d+$/.test(n) ? n : BASE_SEPOLIA) as Network;
}

/** Which facilitator this app uses, as plain words for the README and the boot log. */
export function facilitatorKind(env: Env = process.env): "cdp" | "local" | "url" | "test" {
  if (env.CDP_API_KEY_ID?.trim() && env.CDP_API_KEY_SECRET?.trim()) return "cdp";
  if (localRpc(env)) return "local";
  return env.X402_FACILITATOR_URL?.trim() ? "url" : "test";
}

/** YOUR wallet address that receives payments (public address only), or null when it is not set. */
export function payTo(env: Env = process.env): `0x${string}` | null {
  const a = env.X402_PAY_TO?.trim();
  return a && /^0x[0-9a-fA-F]{40}$/.test(a) ? (a as `0x${string}`) : null;
}

/** X402_LOCAL_RPC when it is a localhost address, else null (a remote RPC is refused: the dev key must stay local). */
export function localRpc(env: Env = process.env): string | null {
  const url = env.X402_LOCAL_RPC?.trim();
  if (!url) return null;
  try {
    return ["127.0.0.1", "localhost", "[::1]"].includes(new URL(url).hostname) ? url : null;
  } catch {
    return null;
  }
}

/** Checks and settles payments in this process against the local fork. */
function localFacilitator(rpc: string, network: Network): FacilitatorClient {
  const account = privateKeyToAccount(ANVIL_FACILITATOR_KEY);
  const wallet = createWalletClient({ account, chain: baseSepolia, transport: http(rpc) }).extend(publicActions);
  const facilitator = new x402Facilitator().register(network, new ExactEvmFacilitator(toFacilitatorEvmSigner({ ...wallet, address: account.address } as never)));
  return {
    verify: (payload, requirements) => facilitator.verify(payload, requirements),
    settle: (payload, requirements) => facilitator.settle(payload, requirements),
    // The facilitator types its networks as plain strings; every one registered here is CAIP-2.
    getSupported: async () => facilitator.getSupported() as Awaited<ReturnType<FacilitatorClient["getSupported"]>>,
  };
}

export function makeServer(env: Env = process.env): x402ResourceServer {
  const kind = facilitatorKind(env);
  if (kind !== "cdp" && x402Network(env) === BASE) throw new Error("x402: Base mainnet needs CDP_API_KEY_ID and CDP_API_KEY_SECRET (x402.org serves test networks only)");
  const facilitator =
    kind === "cdp"
      ? createCdpFacilitatorClient({ apiKeyId: env.CDP_API_KEY_ID, apiKeySecret: env.CDP_API_KEY_SECRET })
      : kind === "local"
        ? localFacilitator(localRpc(env)!, x402Network(env))
        : new HTTPFacilitatorClient({ url: env.X402_FACILITATOR_URL?.trim() || TEST_FACILITATOR });
  return new x402ResourceServer(facilitator).register("eip155:*", new ExactEvmScheme());
}

/** The one server every paid route shares. */
export const server = makeServer();
