// THE SIGN-IN SEAM. Pages and routes call `currentUser()`; how people sign in (Google today, see lib/google.ts and
// app/api/auth/google) can change here without touching them.

import { cookies } from "next/headers";
import { SESSION_COOKIE, openSession, type Session } from "./session";

export async function currentUser(): Promise<Session | null> {
  return openSession((await cookies()).get(SESSION_COOKIE)?.value);
}

/** Where Google sends people back. Your site's address + this path goes in the Google client's redirect URIs. */
export const callbackPath = "/api/auth/google/callback";
