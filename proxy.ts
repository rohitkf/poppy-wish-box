import { NextResponse, type NextRequest } from "next/server";
import { readSession, SESSION_COOKIE, SESSION_RENEW_AFTER, sessionCookieOptions, signSession } from "@/lib/session";

// Optimistic gate: send anyone without a valid session to /unlock.
// Real enforcement is the same cookie check in every API route.
export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const session = await readSession(req.cookies.get(SESSION_COOKIE)?.value);

  if (pathname === "/unlock") {
    return session ? NextResponse.redirect(new URL("/", req.url)) : NextResponse.next();
  }
  if (!session) {
    return NextResponse.redirect(new URL("/unlock", req.url));
  }
  const res = NextResponse.next();
  // Opening the app at least every 60 days keeps a device unlocked, so it rarely needs the
  // code again (and isn't shut out while unlocking is paused for everyone).
  if (Date.now() / 1000 - session.issuedAt > SESSION_RENEW_AFTER) {
    res.cookies.set(SESSION_COOKIE, await signSession(), sessionCookieOptions);
  }
  return res;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|sw.js|manifest.webmanifest|icons|icon|apple-icon|favicon.ico|offline).*)"],
};
