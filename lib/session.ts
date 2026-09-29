import "server-only";
import { SignJWT, jwtVerify } from "jose";
import type { NextRequest } from "next/server";

export const SESSION_COOKIE = "ours_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 60; // 60 days

function sessionKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("SESSION_SECRET must be set (32+ random characters)");
  return new TextEncoder().encode(secret);
}

export async function signSession(spaceId: string) {
  return new SignJWT({ space_id: spaceId, typ: "ours-session" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(sessionKey());
}

export async function verifySession(token: string | undefined): Promise<string | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, sessionKey(), { algorithms: ["HS256"] });
    if (payload.typ !== "ours-session" || typeof payload.space_id !== "string") return null;
    return payload.space_id;
  } catch {
    return null;
  }
}

/** Space id for this request, or null when locked. */
export async function spaceFromRequest(req: NextRequest) {
  return verifySession(req.cookies.get(SESSION_COOKIE)?.value);
}

export function unauthorized() {
  return Response.json({ error: "Locked" }, { status: 401, headers: { "Cache-Control": "no-store" } });
}
