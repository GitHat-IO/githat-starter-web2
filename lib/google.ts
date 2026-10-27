// Sign in with Google: the OpenID Connect code flow with PKCE, no SDK. The ID token comes straight from Google's
// token endpoint over TLS (so its signature need not be re-checked here), and its audience, issuer, expiry and
// verified email are still checked.

import { createHash, randomBytes } from "node:crypto";

export const GOOGLE_AUTH = "https://accounts.google.com/o/oauth2/v2/auth";
export const GOOGLE_TOKEN = "https://oauth2.googleapis.com/token";

export const randomToken = () => randomBytes(32).toString("base64url");
export const challengeFor = (verifier: string) => createHash("sha256").update(verifier).digest("base64url");

export function authorizeUrl(input: { clientId: string; redirectUri: string; state: string; verifier: string }): string {
  const q = new URLSearchParams({
    client_id: input.clientId,
    redirect_uri: input.redirectUri,
    response_type: "code",
    scope: "openid email",
    state: input.state,
    code_challenge: challengeFor(input.verifier),
    code_challenge_method: "S256",
    prompt: "select_account",
  });
  return `${GOOGLE_AUTH}?${q}`;
}

export type GoogleUser = { sub: string; email: string };

/** Trades the code for the signed-in Google account, or null when anything does not check out. */
export async function exchangeCode(
  input: { code: string; verifier: string; clientId: string; clientSecret: string; redirectUri: string },
  fetchImpl: typeof fetch = fetch,
  nowS = Math.floor(Date.now() / 1000),
): Promise<GoogleUser | null> {
  const res = await fetchImpl(GOOGLE_TOKEN, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code: input.code,
      code_verifier: input.verifier,
      client_id: input.clientId,
      client_secret: input.clientSecret,
      redirect_uri: input.redirectUri,
    }),
  });
  if (!res.ok) return null;
  const { id_token } = (await res.json()) as { id_token?: string };
  if (!id_token) return null;
  try {
    const claims = JSON.parse(Buffer.from(id_token.split(".")[1] ?? "", "base64url").toString("utf8")) as {
      aud?: string; iss?: string; exp?: number; sub?: string; email?: string; email_verified?: boolean;
    };
    const issOk = claims.iss === "https://accounts.google.com" || claims.iss === "accounts.google.com";
    if (claims.aud !== input.clientId || !issOk || !claims.exp || claims.exp <= nowS) return null;
    if (!claims.sub || !claims.email || claims.email_verified !== true) return null;
    return { sub: claims.sub, email: claims.email };
  } catch {
    return null;
  }
}
