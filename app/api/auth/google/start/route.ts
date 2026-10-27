import { cookies } from "next/headers";
import { callbackPath } from "../../../../../lib/auth";
import { authorizeUrl, randomToken } from "../../../../../lib/google";
import { cookieOptions } from "../../../../../lib/session";

// Starts Google sign-in: a fresh state and PKCE verifier in short-lived cookies, then off to Google.
export async function GET(request: Request): Promise<Response> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) return Response.json({ error: "Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET (README, step 2)." }, { status: 500 });
  const state = randomToken();
  const verifier = randomToken();
  const jar = await cookies();
  jar.set("g_state", state, cookieOptions(600));
  jar.set("g_verifier", verifier, cookieOptions(600));
  const redirectUri = new URL(callbackPath, request.url).toString();
  return Response.redirect(authorizeUrl({ clientId, redirectUri, state, verifier }), 302);
}
