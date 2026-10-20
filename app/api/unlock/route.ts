import { NextResponse, type NextRequest } from "next/server";
import { createHash, timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";
import { appPin, SESSION_COOKIE, SESSION_MAX_AGE, signSession } from "@/lib/session";

export const dynamic = "force-dynamic";

const MAX_FAILURES = 5;
const LOCKOUT_MINUTES = 15;

function clientIp(req: NextRequest) {
  return req.headers.get("x-real-ip") || req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

const digest = (s: string) => createHash("sha256").update(s).digest();

export async function POST(req: NextRequest) {
  const pin = appPin();
  if (!pin) {
    return NextResponse.json({ error: "The unlock code isn't set up yet. Add APP_PIN in Vercel, then redeploy." }, { status: 503 });
  }
  // Replies carry the code's length (the unlock page shows it anyway), so a page left
  // open across an APP_PIN change can adjust before the next try.
  const reply = (status: number, error: string) => NextResponse.json({ error, length: pin.length }, { status });

  const body = await req.json().catch(() => null);
  const code = typeof body?.code === "string" ? body.code.trim() : "";
  if (!/^\d{1,12}$/.test(code)) return reply(400, "Enter the code, numbers only.");

  const pool = db();
  const ip = clientIp(req);

  // Count this attempt before comparing, in one statement, so parallel requests can't
  // all slip past the limit. Only an expired lockout resets the count.
  const { rows } = await pool.query(
    `insert into unlock_attempts as a (ip, failures, updated_at) values ($1, 1, now())
     on conflict (ip) do update set
       failures = case when a.locked_until <= now() then 1 else a.failures + 1 end,
       locked_until = case when a.locked_until <= now() then null else a.locked_until end,
       updated_at = now()
     returning failures, ceil(extract(epoch from locked_until - now()) / 60)::int as mins`,
    [ip],
  );
  const { failures, mins } = rows[0] as { failures: number; mins: number | null };
  if (mins && mins > 0) return reply(429, `Too many wrong tries. Try again in ${mins} minute${mins === 1 ? "" : "s"}.`);
  const pause = async () => {
    await pool.query("update unlock_attempts set locked_until = now() + make_interval(mins => $2) where ip = $1", [
      ip,
      LOCKOUT_MINUTES,
    ]);
    return reply(429, `Too many wrong tries. Entry is paused for ${LOCKOUT_MINUTES} minutes.`);
  };
  if (failures > MAX_FAILURES) return pause();

  if (!timingSafeEqual(digest(code), digest(pin))) {
    if (failures >= MAX_FAILURES) return pause();
    const left = MAX_FAILURES - failures;
    return reply(401, `That's not it. ${left} ${left === 1 ? "try" : "tries"} left before a ${LOCKOUT_MINUTES} minute pause.`);
  }

  await pool.query("delete from unlock_attempts where ip = $1", [ip]);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, await signSession(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return res;
}
