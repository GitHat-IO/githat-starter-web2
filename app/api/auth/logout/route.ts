import { cookies } from "next/headers";
import { SESSION_COOKIE } from "../../../../lib/session";

// Sign out: a plain POST (the button is a form), so it cannot be triggered by a link on another site.
export async function POST(request: Request): Promise<Response> {
  (await cookies()).delete(SESSION_COOKIE);
  return Response.redirect(new URL("/", request.url), 303);
}
