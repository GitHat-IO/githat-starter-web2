// x402 pay-per-call, the requirement builder. Same shape as the one in the GitHat fleet's
// ClickReserv app (lib/ai-credit-x402.ts), pointed at Base SEPOLIA only (a test network:
// the money here has no value). Going to mainnet is a deliberate edit, not a setting.

/** Base Sepolia. Test network only. */
export const X402_NETWORK = { name: "base-sepolia", chainId: 84532 } as const;

/**
 * Circle's test USDC on Base Sepolia (6 decimals). Check it against Circle's published
 * testnet addresses before you rely on it.
 */
export const USDC_BASE_SEPOLIA = "0x036CbD53842c5426634e7929541eC2318f3dCF7e" as const;

export type X402Requirement = {
  scheme: "exact";
  network: typeof X402_NETWORK.name;
  /** USDC smallest units (6 decimals), as a decimal string. */
  maxAmountRequired: string;
  asset: `0x${string}`;
  payTo: `0x${string}`;
  resource: string;
  description: string;
  mimeType: "application/json";
  maxTimeoutSeconds: number;
};

export type X402Body = { x402Version: 1; error: string; accepts: X402Requirement[] };

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

export function isAddress(v: unknown): v is `0x${string}` {
  return typeof v === "string" && ADDRESS_RE.test(v);
}

/** Cents of USD -> USDC smallest units. 1 cent = 10_000 units. Whole cents only. */
export function usdcUnits(cents: number): bigint {
  if (!Number.isInteger(cents) || cents < 1) throw new Error("x402: price must be a whole number of cents, at least 1");
  return BigInt(cents) * BigInt(10000);
}

/** What a 402 answer asks for. Pure. `payTo` is YOUR wallet (X402_PAY_TO), never a GitHat wallet. */
export function x402PaymentRequirements(input: {
  resource: string;
  cents: number;
  payTo: string;
  description?: string;
  maxTimeoutSeconds?: number;
}): X402Body {
  if (!isAddress(input.payTo)) throw new Error("x402: payTo must be a 0x address (set X402_PAY_TO to your own wallet)");
  return {
    x402Version: 1,
    error: "Payment required",
    accepts: [
      {
        scheme: "exact",
        network: X402_NETWORK.name,
        maxAmountRequired: usdcUnits(input.cents).toString(),
        asset: USDC_BASE_SEPOLIA,
        payTo: input.payTo,
        resource: input.resource,
        description: input.description ?? `Pay ${(input.cents / 100).toFixed(2)} USDC (test network) for one call`,
        mimeType: "application/json",
        maxTimeoutSeconds: input.maxTimeoutSeconds ?? 60,
      },
    ],
  };
}

export type Verdict = { ok: true; settlement: string } | { ok: false; status: 402 | 502; reason: string };

/** The x402 facilitator that checks and settles payments. x402.org's runs Base Sepolia for free; set X402_FACILITATOR_URL to use another. */
export const DEFAULT_FACILITATOR = "https://x402.org/facilitator";

/**
 * Checks a payment for real and settles it: the X-PAYMENT header is decoded, then the facilitator's /verify confirms the
 * signed USDC transfer pays at least what `requirement` asks, to `requirement.payTo`, on Base Sepolia, and /settle puts
 * it on chain once. Nothing the header says about itself is believed. `settlement` is the base64 X-PAYMENT-RESPONSE
 * header to send back (the transaction the caller can look up).
 */
export async function verifyAndSettle(
  header: string | null,
  requirement: X402Requirement,
  env: Record<string, string | undefined> = process.env,
  fetchImpl: typeof fetch = fetch,
): Promise<Verdict> {
  if (!header) return { ok: false, status: 402, reason: "no payment header" };
  let paymentPayload: unknown;
  try {
    paymentPayload = JSON.parse(Buffer.from(header, "base64").toString("utf8"));
  } catch {
    return { ok: false, status: 402, reason: "payment header is not base64 JSON" };
  }
  if (typeof paymentPayload !== "object" || paymentPayload === null || (paymentPayload as { network?: unknown }).network !== requirement.network) {
    return { ok: false, status: 402, reason: `payment header must name network ${requirement.network}` };
  }
  const base = (env.X402_FACILITATOR_URL?.trim() || DEFAULT_FACILITATOR).replace(/\/+$/, "");
  const body = JSON.stringify({ x402Version: 1, paymentPayload, paymentRequirements: requirement });
  const post = (path: string) =>
    fetchImpl(`${base}/${path}`, { method: "POST", headers: { "content-type": "application/json" }, body, signal: AbortSignal.timeout(15_000) });
  try {
    const v = await post("verify");
    if (!v.ok) return { ok: false, status: 502, reason: `facilitator /verify answered ${v.status}` };
    const verified = (await v.json()) as { isValid?: boolean; invalidReason?: string };
    if (!verified.isValid) return { ok: false, status: 402, reason: verified.invalidReason ?? "payment is not valid" };
    const st = await post("settle");
    if (!st.ok) return { ok: false, status: 502, reason: `facilitator /settle answered ${st.status}` };
    const settled = (await st.json()) as { success?: boolean; errorReason?: string };
    if (!settled.success) return { ok: false, status: 402, reason: settled.errorReason ?? "payment did not settle" };
    return { ok: true, settlement: Buffer.from(JSON.stringify(settled)).toString("base64") };
  } catch {
    return { ok: false, status: 502, reason: "the facilitator could not be reached" };
  }
}
