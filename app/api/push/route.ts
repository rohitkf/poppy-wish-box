import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { errorHeaders, readJson } from "@/lib/http";
import { isPushEndpoint, sendPush, vapidKeys } from "@/lib/push";
import { HttpError } from "@/lib/server-data";
import { isUnlocked, unauthorized } from "@/lib/session";
import { currentSpaceId, noSpace } from "@/lib/space";

export const dynamic = "force-dynamic";

/** The public key a phone needs to subscribe. */
export async function GET(req: NextRequest) {
  if (!(await isUnlocked(req))) return unauthorized();
  const { publicKey } = await vapidKeys();
  return Response.json({ publicKey }, { headers: { "Cache-Control": "no-store" } });
}

type Body = {
  action?: "subscribe" | "unsubscribe" | "test";
  subscription?: { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };
  endpoint?: unknown;
  deviceId?: unknown;
  name?: unknown;
};

const str = (v: unknown, max: number) => (typeof v === "string" && v.length > 0 && v.length <= max ? v : null);

/** Subscribe this phone to expiry reminders, unsubscribe it, or send it a test notification. */
export async function POST(req: NextRequest) {
  if (!(await isUnlocked(req))) return unauthorized();
  const spaceId = await currentSpaceId();
  if (!spaceId) return noSpace();
  let body: Body;
  try {
    body = ((await readJson(req, 4096)) ?? {}) as Body;
  } catch (e) {
    if (e instanceof HttpError) return Response.json({ error: e.message }, { status: e.status, headers: errorHeaders(e) });
    throw e;
  }
  const pool = db();

  if (body.action === "subscribe") {
    const s = body.subscription;
    const endpoint = s?.endpoint;
    const p256dh = str(s?.keys?.p256dh, 200);
    const auth = str(s?.keys?.auth, 100);
    if (!isPushEndpoint(endpoint) || !p256dh || !auth) return Response.json({ error: "That isn't a browser push subscription." }, { status: 400 });
    await pool.query(
      `insert into push_subscriptions (endpoint, space_id, p256dh, auth, device_id, name)
       values ($1, $2, $3, $4, $5, $6)
       on conflict (endpoint) do update set p256dh = excluded.p256dh, auth = excluded.auth,
         device_id = excluded.device_id, name = excluded.name, space_id = excluded.space_id`,
      [endpoint, spaceId, p256dh, auth, str(body.deviceId, 64), str(body.name, 40)],
    );
    return Response.json({ ok: true });
  }

  if (!isPushEndpoint(body.endpoint)) return Response.json({ error: "Unknown subscription." }, { status: 400 });

  if (body.action === "unsubscribe") {
    await pool.query("delete from push_subscriptions where endpoint = $1 and space_id = $2", [body.endpoint, spaceId]);
    return Response.json({ ok: true });
  }

  if (body.action === "test") {
    const { rows } = await pool.query("select endpoint, p256dh, auth from push_subscriptions where endpoint = $1 and space_id = $2", [
      body.endpoint,
      spaceId,
    ]);
    if (!rows[0]) return Response.json({ error: "This device isn't subscribed." }, { status: 404 });
    const ok = await sendPush(rows[0], {
      title: "Ours: reminders are on",
      body: "You'll get a note in the morning when pantry food is close to its date, or a calendar event you asked to be reminded of is coming up.",
      url: "/",
      tag: "ours-test",
    });
    if (!ok) {
      await pool.query("delete from push_subscriptions where endpoint = $1", [body.endpoint]);
      return Response.json({ error: "This device's subscription has expired. Turn reminders off and on again." }, { status: 410 });
    }
    return Response.json({ ok: true });
  }

  return Response.json({ error: "Unknown action." }, { status: 400 });
}
