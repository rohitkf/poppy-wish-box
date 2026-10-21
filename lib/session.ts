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

// Cookies are signed with a key derived from the code plus a server-only secret. On Vercel that's
// DATABASE_URL, which every deployment already has. Elsewhere it's SESSION_SECRET, because a
// container's DATABASE_URL is often a well-known local one. Changing the code (or the secret) signs
// every device out, and a cookie can't be forged or brute-forced without both.
function sessionSecret(): string | null {
  if (process.env.VERCEL) return process.env.DATABASE_URL || null;
  const secret = process.env.SESSION_SECRET?.trim();
  return secret && secret.length >= 32 ? secret : null;
}

/** Why unlocking can't work yet (a missing setting), or null when it can. */
export function setupProblem(): string | null {
  if (!appPin()) {
    return process.env.VERCEL
      ? "The unlock code isn't set up yet. Add APP_PIN in Vercel, then redeploy."
      : "The unlock code isn't set up yet. Set APP_PIN to a 4–12 digit code, then restart.";
  }
  if (!sessionSecret()) {
    return process.env.VERCEL
      ? "DATABASE_URL isn't set. Connect the Neon database in Vercel → Storage, then redeploy."
      : "Set SESSION_SECRET to a random string of at least 32 characters, then restart.";
  }
  return null;
}

async function sessionKey() {
  const pin = appPin();
  const secret = sessionSecret();
  if (!pin || !secret) throw new Error(setupProblem() ?? "Unlocking isn't set up");
  const material = new TextEncoder().encode(`ours-session|${secret}|${pin}`);
  return new Uint8Array(await crypto.subtle.digest("SHA-256", material));
}

export const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
  maxAge: SESSION_MAX_AGE,
} as const;

/** A cookie older than this is renewed when the app is opened, so devices in use stay unlocked. */
export const SESSION_RENEW_AFTER = 60 * 60 * 24; // 1 day

export async function signSession() {
  return new SignJWT({ typ: "ours-session" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(await sessionKey());
}

/** The session in a cookie, or null when it's missing, expired or not signed with the current key. */
export async function readSession(token: string | undefined): Promise<{ issuedAt: number } | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, await sessionKey(), { algorithms: ["HS256"] });
    return payload.typ === "ours-session" ? { issuedAt: payload.iat ?? 0 } : null;
  } catch {
    return null;
  }
}

export async function verifySession(token: string | undefined): Promise<boolean> {
  return (await readSession(token)) !== null;
}

/** True when this request carries a valid unlock cookie. */
export async function isUnlocked(req: NextRequest) {
  return verifySession(req.cookies.get(SESSION_COOKIE)?.value);
}

export function unauthorized() {
  return Response.json({ error: "Locked" }, { status: 401, headers: { "Cache-Control": "no-store" } });
}
