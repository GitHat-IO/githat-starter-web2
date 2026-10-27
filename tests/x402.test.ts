import { describe, expect, it } from "vitest";

import { BASE, BASE_SEPOLIA, facilitatorKind, localRpc, makeServer, payTo, x402Network } from "../lib/x402";

describe("x402 setup (the x402 Foundation's packages)", () => {
  it("defaults to Base Sepolia, a test network; going live is a deliberate setting", () => {
    expect(x402Network({})).toBe(BASE_SEPOLIA);
    expect(x402Network({ X402_NETWORK: BASE })).toBe(BASE);
    expect(x402Network({ X402_NETWORK: "nonsense" })).toBe(BASE_SEPOLIA);
  });

  it("uses Coinbase's CDP facilitator when both CDP keys are set, else the URL given, else the test facilitator", () => {
    expect(facilitatorKind({ CDP_API_KEY_ID: "id", CDP_API_KEY_SECRET: "secret" })).toBe("cdp");
    expect(facilitatorKind({ CDP_API_KEY_ID: "id" })).toBe("test");
    expect(facilitatorKind({ X402_FACILITATOR_URL: "https://f.example" })).toBe("url");
    expect(facilitatorKind({})).toBe("test");
  });

  it("settles against a local anvil fork only at a localhost address (the dev key must never meet a real RPC)", () => {
    expect(facilitatorKind({ X402_LOCAL_RPC: "http://127.0.0.1:8545" })).toBe("local");
    expect(localRpc({ X402_LOCAL_RPC: "http://localhost:8545" })).toBe("http://localhost:8545");
    expect(localRpc({ X402_LOCAL_RPC: "https://sepolia.base.org" })).toBeNull();
    expect(localRpc({ X402_LOCAL_RPC: "http://127.0.0.1.evil.example:8545" })).toBeNull();
    expect(localRpc({ X402_LOCAL_RPC: "not a url" })).toBeNull();
    expect(() => makeServer({ X402_LOCAL_RPC: "http://127.0.0.1:8545" })).not.toThrow();
  });

  it("refuses Base mainnet without the CDP keys (x402.org serves test networks only)", () => {
    expect(() => makeServer({ X402_NETWORK: BASE })).toThrow(/CDP_API_KEY_ID/);
    expect(() => makeServer({})).not.toThrow();
  });

  it("pays only a well-formed public address you set", () => {
    expect(payTo({ X402_PAY_TO: "0x1111111111111111111111111111111111111111" })).toBe("0x1111111111111111111111111111111111111111");
    expect(payTo({ X402_PAY_TO: "my-wallet" })).toBeNull();
    expect(payTo({})).toBeNull();
  });
});
