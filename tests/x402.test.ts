import { describe, expect, it } from "vitest";

import { requirePayment } from "../lib/payments";
import { DEFAULT_FACILITATOR, USDC_BASE_SEPOLIA, X402_NETWORK, usdcUnits, verifyAndSettle, x402PaymentRequirements } from "../lib/x402";

const WALLET = "0x1111111111111111111111111111111111111111";
const url = "http://localhost:3000/api/x402/hello";
const header = (obj: unknown) => Buffer.from(JSON.stringify(obj)).toString("base64");
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const env = { X402_PAY_TO: WALLET };

describe("requirement builder", () => {
  it("asks for USDC on Base Sepolia, to the developer's wallet", () => {
    const b = x402PaymentRequirements({ resource: url, cents: 1, payTo: WALLET });
    expect(b.accepts[0]).toMatchObject({ scheme: "exact", network: "base-sepolia", asset: USDC_BASE_SEPOLIA, payTo: WALLET, maxAmountRequired: "10000" });
    expect(X402_NETWORK.chainId).toBe(84532);
  });
  it("prices in whole cents only, and refuses a missing wallet", () => {
    expect(usdcUnits(250)).toBe(2_500_000n);
    expect(() => usdcUnits(0.5)).toThrow();
    expect(() => x402PaymentRequirements({ resource: url, cents: 1, payTo: "" })).toThrow();
  });
});

describe("a real payment check: the facilitator verifies, then settles", () => {
  const requirement = x402PaymentRequirements({ resource: url, cents: 1, payTo: WALLET }).accepts[0];

  it("pays only after /verify says valid AND /settle succeeds, and returns the settlement", async () => {
    const calls: string[] = [];
    const out = await verifyAndSettle(header({ network: "base-sepolia", payload: {} }), requirement, {}, async (u, init) => {
      calls.push(String(u));
      expect(JSON.parse(String(init?.body))).toMatchObject({ x402Version: 1, paymentRequirements: requirement });
      return String(u).endsWith("/verify") ? json({ isValid: true }) : json({ success: true, transaction: "0xabc", network: "base-sepolia" });
    });
    expect(calls).toEqual([`${DEFAULT_FACILITATOR}/verify`, `${DEFAULT_FACILITATOR}/settle`]);
    expect(out.ok).toBe(true);
    if (out.ok) expect(JSON.parse(Buffer.from(out.settlement, "base64").toString())).toMatchObject({ transaction: "0xabc" });
  });

  it("never believes the header: an invalid payment is refused and never settled", async () => {
    const calls: string[] = [];
    const out = await verifyAndSettle(header({ network: "base-sepolia" }), requirement, {}, async (u) => {
      calls.push(String(u));
      return json({ isValid: false, invalidReason: "insufficient_funds" });
    });
    expect(out).toEqual({ ok: false, status: 402, reason: "insufficient_funds" });
    expect(calls).toHaveLength(1);
  });

  it("refuses a missing, malformed or wrong-network header without asking anyone", async () => {
    const never = async () => { throw new Error("must not call the facilitator"); };
    expect(await verifyAndSettle(null, requirement, {}, never)).toMatchObject({ ok: false, status: 402 });
    expect(await verifyAndSettle("%%%", requirement, {}, never)).toMatchObject({ ok: false, status: 402 });
    expect(await verifyAndSettle(header({ network: "base" }), requirement, {}, never)).toMatchObject({ ok: false, status: 402 });
  });

  it("a failed settlement is not a payment; an unreachable facilitator is a 502", async () => {
    const failedSettle = async (u: unknown) => (String(u).endsWith("/verify") ? json({ isValid: true }) : json({ success: false, errorReason: "nonce_used" }));
    expect(await verifyAndSettle(header({ network: "base-sepolia" }), requirement, {}, failedSettle)).toMatchObject({ ok: false, status: 402, reason: "nonce_used" });
    expect(await verifyAndSettle(header({ network: "base-sepolia" }), requirement, {}, async () => { throw new Error("down"); })).toMatchObject({ ok: false, status: 502 });
  });

  it("uses another facilitator when X402_FACILITATOR_URL is set", async () => {
    const seen: string[] = [];
    await verifyAndSettle(header({ network: "base-sepolia" }), requirement, { X402_FACILITATOR_URL: "https://f.example/" }, async (u) => {
      seen.push(String(u));
      return json({ isValid: false });
    });
    expect(seen[0]).toBe("https://f.example/verify");
  });
});

describe("the payments seam", () => {
  it("answers 402 with what to pay when there is no payment", async () => {
    const r = await requirePayment(new Request(url), { cents: 1 }, env);
    expect(r).toBeInstanceOf(Response);
    expect((r as Response).status).toBe(402);
    expect(((await (r as Response).json()) as { accepts: unknown[] }).accepts).toHaveLength(1);
  });
  it("answers 500 when the developer has not set a wallet", async () => {
    expect(((await requirePayment(new Request(url), { cents: 1 }, {})) as Response).status).toBe(500);
  });
  it("lets a settled payment through with its settlement", async () => {
    const req = new Request(url, { headers: { "x-payment": header({ network: "base-sepolia" }) } });
    const r = await requirePayment(req, { cents: 1 }, env, async (u) => (String(u).endsWith("/verify") ? json({ isValid: true }) : json({ success: true })));
    expect(r).toHaveProperty("settlement");
  });
});
