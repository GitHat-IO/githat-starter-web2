// A session is a signed cookie: { sub, email, exp }, HMAC-SHA256 with SESSION_SECRET. No database, no library.
// Change SESSION_SECRET and every session ends.

import { createHmac, timingSafeEqual } from "node:crypto";

export type Session = { sub: string; email: string; exp: number };
export const SESSION_COOKIE = "session";
export const SESSION_TTL_S = 7 * 24 * 3600;

function secret(env: Record<string, string | undefined>): string {
  const s = env.SESSION_SECRET ?? "";
  if (s.length < 32) throw new Error("SESSION_SECRET must be at least 32 characters (openssl rand -hex 32)");
  return s;
}

const sign = (data: string, key: string) => createHmac("sha256", key).update(data).digest("base64url");

export function sealSession(session: Session, env: Record<string, string | undefined> = process.env): string {
  const data = Buffer.from(JSON.stringify(session)).toString("base64url");
  return `${data}.${sign(data, secret(env))}`;
}

/** The session in a cookie value, or null when it is missing, forged, altered or expired. */
export function openSession(value: string | undefined, env: Record<string, string | undefined> = process.env, nowS = Math.floor(Date.now() / 1000)): Session | null {
  if (!value) return null;
  const [data, mac] = value.split(".");
  if (!data || !mac) return null;
  const expected = Buffer.from(sign(data, secret(env)));
  const given = Buffer.from(mac);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const s = JSON.parse(Buffer.from(data, "base64url").toString("utf8")) as Session;
    return typeof s.sub === "string" && typeof s.exp === "number" && s.exp > nowS ? s : null;
  } catch {
    return null;
  }
}

export const cookieOptions = (maxAge: number) => ({ httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/", maxAge });
