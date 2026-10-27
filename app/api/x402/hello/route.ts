// Example pay-per-call endpoint. Copy this file to add your own paid routes.
//   curl -i http://localhost:3000/api/x402/hello   -> 402 + what to pay (0.01 test USDC on Base Sepolia)
// Any x402 client (an agent, x402-fetch, the GitHat CLI) pays and retries with an X-PAYMENT header.

import { requirePayment } from "../../../../lib/payments";

export async function GET(request: Request): Promise<Response> {
  const paid = await requirePayment(request, { cents: 1, description: "One hello, 0.01 test USDC" });
  if (paid instanceof Response) return paid;
  return Response.json({ message: "hello, paid caller" }, { headers: { "x-payment-response": paid.settlement } });
}
