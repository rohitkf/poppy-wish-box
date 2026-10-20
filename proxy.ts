import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

// Optimistic gate: send anyone without a valid session to /unlock.
// Real enforcement is the same cookie check in every API route.
export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const unlocked = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);

  if (pathname === "/unlock") {
    return unlocked ? NextResponse.redirect(new URL("/", req.url)) : NextResponse.next();
  }
  if (!unlocked) {
    return NextResponse.redirect(new URL("/unlock", req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|sw.js|manifest.webmanifest|icons|icon|apple-icon|favicon.ico|offline).*)"],
};
