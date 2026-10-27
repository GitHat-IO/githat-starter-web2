// THE PAYMENTS SEAM. Two ways to take money, both already wired:
//  - Cards: SebasTN's checkout button (components/sebastn-pay.tsx). The charge goes to YOUR Stripe account through
//    SebasTN; you write no payment code.
//  - Pay per call (x402): `requirePayment` below, for API routes. USDC on Base Sepolia, a test network; going to
//    mainnet is a deliberate edit to lib/x402.ts, not a setting.

import { verifyAndSettle, x402PaymentRequirements, X402_NETWORK } from "./x402";

export type PriceRule = { cents: number; description?: string };

/**
 * Returns a Response when the caller must not proceed (402 asking for payment or refusing it, 502 when the facilitator
 * cannot be reached, 500 when you have not set a wallet), or `{ settlement }` when paid: send it back as the
 * X-PAYMENT-RESPONSE header (see app/api/x402/hello/route.ts).
 */
export async function requirePayment(
  request: Request,
  rule: PriceRule,
  env: Record<string, string | undefined> = process.env,
  fetchImpl: typeof fetch = fetch,
): Promise<Response | { settlement: string }> {
  let body;
  try {
    body = x402PaymentRequirements({ resource: request.url, cents: rule.cents, payTo: env.X402_PAY_TO ?? "", description: rule.description });
  } catch {
    return Response.json({ error: "Payments are not configured: set X402_PAY_TO to your wallet address." }, { status: 500 });
  }
  const verdict = await verifyAndSettle(request.headers.get("x-payment"), body.accepts[0], env, fetchImpl);
  if (verdict.ok) return { settlement: verdict.settlement };
  if (verdict.status === 402) return Response.json({ ...body, error: verdict.reason }, { status: 402, headers: { "x-402-network": X402_NETWORK.name } });
  return Response.json({ error: verdict.reason }, { status: verdict.status });
}
