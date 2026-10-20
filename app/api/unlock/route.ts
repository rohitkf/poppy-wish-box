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
    return NextResponse.json({ error: "The unlock code isn't set up yet. Add APP_PIN in Vercel." }, { status: 503 });
  }
  const body = await req.json().catch(() => null);
  const code = typeof body?.code === "string" ? body.code.trim() : "";
  if (!/^\d{1,12}$/.test(code)) {
    return NextResponse.json({ error: "Enter the code, numbers only." }, { status: 400 });
  }

  const pool = db();
  const ip = clientIp(req);

  const { rows: lock } = await pool.query(
    "select ceil(extract(epoch from locked_until - now()) / 60)::int as mins from unlock_attempts where ip = $1 and locked_until > now()",
    [ip],
  );
  if (lock[0]) {
    const mins = lock[0].mins;
    return NextResponse.json(
      { error: `Too many wrong tries. Try again in ${mins} minute${mins === 1 ? "" : "s"}.` },
      { status: 429 },
    );
  }

  if (!timingSafeEqual(digest(code), digest(pin))) {
    // Count failures; an expired lockout starts a fresh count.
    const { rows } = await pool.query(
      `insert into unlock_attempts (ip, failures, updated_at) values ($1, 1, now())
       on conflict (ip) do update set
         failures = case when unlock_attempts.locked_until is not null then 1 else unlock_attempts.failures + 1 end,
         locked_until = null,
         updated_at = now()
       returning failures`,
      [ip],
    );
    const failures: number = rows[0].failures;
    if (failures >= MAX_FAILURES) {
      await pool.query(
        `update unlock_attempts set failures = 0, locked_until = now() + make_interval(mins => $2) where ip = $1`,
        [ip, LOCKOUT_MINUTES],
      );
      return NextResponse.json(
        { error: `Too many wrong tries. Entry is paused for ${LOCKOUT_MINUTES} minutes.` },
        { status: 429 },
      );
    }
    const left = MAX_FAILURES - failures;
    return NextResponse.json(
      { error: `That's not it. ${left} ${left === 1 ? "try" : "tries"} left before a ${LOCKOUT_MINUTES} minute pause.` },
      { status: 401 },
    );
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
