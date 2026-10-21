import { NextResponse, type NextRequest } from "next/server";
import { createHash, timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";
import { clientIp, errorHeaders, readJson } from "@/lib/http";
import { HttpError } from "@/lib/server-data";
import { appPin, SESSION_COOKIE, sessionCookieOptions, setupProblem, signSession } from "@/lib/session";

export const dynamic = "force-dynamic";

const MAX_FAILURES = 5; // per network, then a pause
const GLOBAL_MAX_FAILURES = 30; // from all networks together within a window, then a pause for everyone
const LOCKOUT_MINUTES = 15;
const EVERYONE = "*"; // unlock_attempts row that counts attempts from all networks

const digest = (s: string) => createHash("sha256").update(s).digest();

export async function POST(req: NextRequest) {
  const problem = setupProblem();
  if (problem) return NextResponse.json({ error: problem }, { status: 503 });
  const pin = appPin()!;
  // Replies carry the code's length (the unlock page shows it anyway), so a page left
  // open across an APP_PIN change can adjust before the next try.
  const reply = (status: number, error: string, headers?: HeadersInit) =>
    NextResponse.json({ error, length: pin.length }, { status, headers });

  let body: unknown;
  try {
    body = await readJson(req, 1024);
  } catch (e) {
    if (e instanceof HttpError) return reply(e.status, e.message, errorHeaders(e));
    throw e;
  }
  const raw = (body as { code?: unknown } | null)?.code;
  const code = typeof raw === "string" ? raw.trim() : "";
  if (!/^\d{1,12}$/.test(code)) return reply(400, "Enter the code, numbers only.");

  const pool = db();
  const ip = clientIp(req);
  const minutes = (mins: number) => `${mins} minute${mins === 1 ? "" : "s"}`;
  const pausedForEveryone = (mins: number) =>
    reply(429, `Too many wrong tries lately. Entry is paused for ${minutes(mins)}.`);

  // A short code can be guessed from many networks at once: past a ceiling, pause for everyone.
  // Devices that are already unlocked keep working on their cookies.
  const { rows: everyone } = await pool.query(
    "select ceil(extract(epoch from locked_until - now()) / 60)::int as mins from unlock_attempts where ip = $1 and locked_until > now()",
    [EVERYONE],
  );
  if (everyone[0]) return pausedForEveryone(everyone[0].mins);

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
  if (mins && mins > 0) return reply(429, `Too many wrong tries. Try again in ${minutes(mins)}.`);
  const pause = async () => {
    await pool.query("update unlock_attempts set locked_until = now() + make_interval(mins => $2) where ip = $1", [
      ip,
      LOCKOUT_MINUTES,
    ]);
    return reply(429, `Too many wrong tries. Entry is paused for ${LOCKOUT_MINUTES} minutes.`);
  };
  if (failures > MAX_FAILURES) return pause();

  // The same for all networks together: count first, then compare at most GLOBAL_MAX_FAILURES
  // codes per window. The window restarts after a quiet spell or once a pause has ended.
  const { rows: total } = await pool.query(
    `insert into unlock_attempts as a (ip, failures, updated_at) values ($1, 1, now())
     on conflict (ip) do update set
       failures = case when a.updated_at < now() - make_interval(mins => $2) or a.locked_until <= now()
                       then 1 else a.failures + 1 end,
       locked_until = case when a.locked_until <= now() then null else a.locked_until end,
       updated_at = now()
     returning failures, ceil(extract(epoch from locked_until - now()) / 60)::int as mins`,
    [EVERYONE, LOCKOUT_MINUTES],
  );
  const pauseEveryone = async () => {
    const { rowCount } = await pool.query(
      `update unlock_attempts set locked_until = now() + make_interval(mins => $2)
       where ip = $1 and (locked_until is null or locked_until <= now())`,
      [EVERYONE, LOCKOUT_MINUTES],
    );
    if (rowCount) console.warn(JSON.stringify({ level: "warn", msg: "unlock paused for everyone after many wrong codes" }));
  };
  if (total[0].mins > 0) return pausedForEveryone(total[0].mins);
  if (total[0].failures > GLOBAL_MAX_FAILURES) {
    await pauseEveryone();
    return pausedForEveryone(LOCKOUT_MINUTES);
  }

  if (!timingSafeEqual(digest(code), digest(pin))) {
    if (total[0].failures >= GLOBAL_MAX_FAILURES) await pauseEveryone();
    if (failures >= MAX_FAILURES) return pause();
    const left = MAX_FAILURES - failures;
    return reply(401, `That's not it. ${left} ${left === 1 ? "try" : "tries"} left before a ${LOCKOUT_MINUTES} minute pause.`);
  }

  // The right code doesn't count against everyone's limit.
  await pool.query("update unlock_attempts set failures = greatest(failures - 1, 0) where ip = $1", [EVERYONE]);
  await pool.query("delete from unlock_attempts where ip = $1", [ip]);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, await signSession(), sessionCookieOptions);
  return res;
}
