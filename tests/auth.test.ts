import { describe, expect, it } from "vitest";

import { authorizeUrl, challengeFor, exchangeCode } from "../lib/google";
import { openSession, sealSession } from "../lib/session";

const env = { SESSION_SECRET: "x".repeat(40) };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const idToken = (claims: object) => `h.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.s`;

describe("session cookie", () => {
  it("opens what it sealed, and nothing forged, altered or expired", () => {
    const s = { sub: "google:1", email: "a@b.co", exp: 2_000 };
    const v = sealSession(s, env);
    expect(openSession(v, env, 1_000)).toEqual(s);
    expect(openSession(v, env, 3_000)).toBeNull();
    expect(openSession(v, { SESSION_SECRET: "y".repeat(40) }, 1_000)).toBeNull();
    const [data, mac] = v.split(".");
    const tampered = Buffer.from(JSON.stringify({ ...s, email: "evil@x.co" })).toString("base64url");
    expect(openSession(`${tampered}.${mac}`, env, 1_000)).toBeNull();
    expect(openSession(`${data}.`, env, 1_000)).toBeNull();
    expect(openSession(undefined, env)).toBeNull();
  });
  it("refuses a short secret", () => {
    expect(() => sealSession({ sub: "a", email: "", exp: 1 }, { SESSION_SECRET: "short" })).toThrow();
  });
});

describe("Google sign-in", () => {
  const base = { clientId: "cid.apps.googleusercontent.com", clientSecret: "s", redirectUri: "http://localhost:3000/api/auth/google/callback", code: "c", verifier: "v" };

  it("sends PKCE (S256) and the state", () => {
    const u = new URL(authorizeUrl({ clientId: base.clientId, redirectUri: base.redirectUri, state: "st", verifier: "ver" }));
    expect(u.searchParams.get("code_challenge")).toBe(challengeFor("ver"));
    expect(u.searchParams.get("code_challenge_method")).toBe("S256");
    expect(u.searchParams.get("state")).toBe("st");
  });

  it("accepts only a token for this client, from Google, unexpired, with a verified email", async () => {
    const good = { aud: base.clientId, iss: "https://accounts.google.com", exp: 2_000, sub: "123", email: "a@b.co", email_verified: true };
    const fetchFor = (claims: object) => async () => json({ id_token: idToken(claims) });
    expect(await exchangeCode(base, fetchFor(good), 1_000)).toEqual({ sub: "123", email: "a@b.co" });
    expect(await exchangeCode(base, fetchFor({ ...good, aud: "other" }), 1_000)).toBeNull();
    expect(await exchangeCode(base, fetchFor({ ...good, iss: "https://evil.example" }), 1_000)).toBeNull();
    expect(await exchangeCode(base, fetchFor(good), 3_000)).toBeNull();
    expect(await exchangeCode(base, fetchFor({ ...good, email_verified: false }), 1_000)).toBeNull();
    expect(await exchangeCode(base, async () => json({ error: "invalid_grant" }, 400), 1_000)).toBeNull();
  });
});
