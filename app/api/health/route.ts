export const dynamic = "force-dynamic";

/** Liveness: the server is up. Never touches the database, so a database outage doesn't restart it. */
export function GET() {
  return Response.json(
    { ok: true, build: process.env.APP_BUILD, uptime: Math.round(process.uptime()) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
