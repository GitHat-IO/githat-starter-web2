// Example pay-per-call endpoint. Copy this file to add your own paid routes.
//   curl -i http://localhost:3000/api/x402/hello   -> 402 + PAYMENT-REQUIRED (what to pay)
// An x402 client (an agent, @x402/fetch, the GitHat CLI) pays and retries with PAYMENT-SIGNATURE. withX402 settles the
// payment only AFTER this handler answers successfully, so a failed call is never charged.

import { NextResponse, type NextRequest } from "next/server";
import { withX402 } from "@x402/next";
import { payTo, server, x402Network } from "../../../../lib/x402";

const wallet = payTo();

const handler = async (_request: NextRequest) => NextResponse.json({ message: "hello, paid caller" });

export const GET = wallet
  ? withX402(
      handler,
      {
        "/api/x402/hello": {
          accepts: { scheme: "exact", price: "$0.01", network: x402Network(), payTo: wallet },
          description: "One hello",
          mimeType: "application/json",
        },
      },
      server,
    )
  : async () => NextResponse.json({ error: "Payments are not configured: set X402_PAY_TO to your wallet address." }, { status: 500 });
