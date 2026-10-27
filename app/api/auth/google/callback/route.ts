import { cookies } from "next/headers";
import { callbackPath } from "../../../../../lib/auth";
import { exchangeCode } from "../../../../../lib/google";
import { SESSION_COOKIE, SESSION_TTL_S, cookieOptions, sealSession } from "../../../../../lib/session";

// Google sends people back here. The state must match the cookie (no sign-in another site started), then the code
// is traded for the account and a session cookie is set.
export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const jar = await cookies();
  const state = jar.get("g_state")?.value;
  const verifier = jar.get("g_verifier")?.value;
  jar.delete("g_state");
  jar.delete("g_verifier");
  const code = url.searchParams.get("code");
  if (!code || !state || !verifier || url.searchParams.get("state") !== state) return Response.redirect(new URL("/?signin=failed", url), 302);
  const user = await exchangeCode({
    code,
    verifier,
    clientId: process.env.GOOGLE_CLIENT_ID ?? "",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    redirectUri: new URL(callbackPath, url).toString(),
  });
  if (!user) return Response.redirect(new URL("/?signin=failed", url), 302);
  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_S;
  jar.set(SESSION_COOKIE, sealSession({ sub: `google:${user.sub}`, email: user.email, exp }), cookieOptions(SESSION_TTL_S));
  return Response.redirect(new URL("/", url), 302);
}
