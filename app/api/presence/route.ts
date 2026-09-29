import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { spaceFromRequest, unauthorized } from "@/lib/session";

export const dynamic = "force-dynamic";

/** Heartbeat: { deviceId, name } marks this device as here; { leave: true } removes it. */
export async function POST(req: NextRequest) {
  const spaceId = await spaceFromRequest(req);
  if (!spaceId) return unauthorized();
  const body = await req.json().catch(() => null);
  const deviceId = typeof body?.deviceId === "string" ? body.deviceId.slice(0, 64) : "";
  const name = typeof body?.name === "string" ? body.name.trim().slice(0, 40) : "";
  if (!deviceId) return Response.json({ error: "Bad request" }, { status: 400 });

  const pool = db();
  if (body.leave || !name) {
    await pool.query("delete from presence where space_id = $1 and device_id = $2", [spaceId, deviceId]);
  } else {
    await pool.query(
      `insert into presence (space_id, device_id, name, last_seen) values ($1, $2, $3, now())
       on conflict (space_id, device_id) do update set name = excluded.name, last_seen = now()`,
      [spaceId, deviceId, name],
    );
  }
  await pool.query("delete from presence where last_seen < now() - interval '5 minutes'");
  return Response.json({ ok: true });
}
