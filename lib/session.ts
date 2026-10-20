import "server-only";
import { SignJWT, jwtVerify } from "jose";
import type { NextRequest } from "next/server";

export const SESSION_COOKIE = "ours_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 60; // 60 days

/** The numeric unlock code from APP_PIN (4–12 digits), or null when it isn't set. */
export function appPin(): string | null {
  const pin = process.env.APP_PIN?.trim();
  return pin && /^\d{4,12}$/.test(pin) ? pin : null;
}

// Cookies are signed with a key derived from the code plus DATABASE_URL, a server-only
// secret every deployment already has, so no extra setting is needed. Changing the code
// signs every device out, and a cookie can't be forged or brute-forced without both.
async function sessionKey() {
  const pin = appPin();
  if (!pin) throw new Error("APP_PIN must be set to a 4–12 digit code");
  const material = new TextEncoder().encode(`ours-session|${process.env.DATABASE_URL ?? ""}|${pin}`);
  return new Uint8Array(await crypto.subtle.digest("SHA-256", material));
}

export async function signSession() {
  return new SignJWT({ typ: "ours-session" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(await sessionKey());
}

export async function verifySession(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, await sessionKey(), { algorithms: ["HS256"] });
    return payload.typ === "ours-session";
  } catch {
    return false;
  }
}

/** True when this request carries a valid unlock cookie. */
export async function isUnlocked(req: NextRequest) {
  return verifySession(req.cookies.get(SESSION_COOKIE)?.value);
}

export function unauthorized() {
  return Response.json({ error: "Locked" }, { status: 401, headers: { "Cache-Control": "no-store" } });
}
