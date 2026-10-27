// Pay per call (x402 v2, the x402 Foundation's own packages: @x402/core, @x402/evm, @x402/next).
//
// Where payments are checked and settled (the "facilitator"):
//  - CDP_API_KEY_ID + CDP_API_KEY_SECRET set: Coinbase's CDP facilitator, which also screens each payment (KYT/OFAC).
//    That is the one to use on Base mainnet.
//  - otherwise X402_FACILITATOR_URL, else https://x402.org/facilitator, which serves TEST networks only.
// The network defaults to Base Sepolia (a test network: the money has no value). Going live is a deliberate setting:
// X402_NETWORK=eip155:8453 (Base) together with the CDP keys.

import { createCdpFacilitatorClient } from "@coinbase/cdp-sdk/x402";
import { HTTPFacilitatorClient, x402ResourceServer } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";

export const BASE_SEPOLIA = "eip155:84532";
export const BASE = "eip155:8453";
export const TEST_FACILITATOR = "https://x402.org/facilitator";

type Env = Record<string, string | undefined>;
type Network = `${string}:${string}`;

/** The network payments are taken on (CAIP-2). */
export function x402Network(env: Env = process.env): Network {
  const n = env.X402_NETWORK?.trim();
  return (n && /^eip155:\d+$/.test(n) ? n : BASE_SEPOLIA) as Network;
}

/** Which facilitator this app uses, as plain words for the README and the boot log. */
export function facilitatorKind(env: Env = process.env): "cdp" | "url" | "test" {
  if (env.CDP_API_KEY_ID?.trim() && env.CDP_API_KEY_SECRET?.trim()) return "cdp";
  return env.X402_FACILITATOR_URL?.trim() ? "url" : "test";
}

/** YOUR wallet address that receives payments (public address only), or null when it is not set. */
export function payTo(env: Env = process.env): `0x${string}` | null {
  const a = env.X402_PAY_TO?.trim();
  return a && /^0x[0-9a-fA-F]{40}$/.test(a) ? (a as `0x${string}`) : null;
}

export function makeServer(env: Env = process.env): x402ResourceServer {
  const kind = facilitatorKind(env);
  if (kind !== "cdp" && x402Network(env) === BASE) throw new Error("x402: Base mainnet needs CDP_API_KEY_ID and CDP_API_KEY_SECRET (x402.org serves test networks only)");
  const facilitator =
    kind === "cdp"
      ? createCdpFacilitatorClient({ apiKeyId: env.CDP_API_KEY_ID, apiKeySecret: env.CDP_API_KEY_SECRET })
      : new HTTPFacilitatorClient({ url: env.X402_FACILITATOR_URL?.trim() || TEST_FACILITATOR });
  return new x402ResourceServer(facilitator).register("eip155:*", new ExactEvmScheme());
}

/** The one server every paid route shares. */
export const server = makeServer();
