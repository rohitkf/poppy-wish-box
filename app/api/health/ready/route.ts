import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Readiness: the server can reach the database. Used by load balancers and container health checks. */
export async function GET() {
  const headers = { "Cache-Control": "no-store" };
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      db().query("select 1"),
      new Promise((_, reject) => (timer = setTimeout(() => reject(new Error("timeout")), 2000))),
    ]);
    return Response.json({ ok: true, build: process.env.APP_BUILD }, { headers });
  } catch (e) {
    console.error("Readiness check failed:", (e as Error).message);
    return Response.json({ ok: false, error: "Database unreachable" }, { status: 503, headers });
  } finally {
    clearTimeout(timer);
  }
}
