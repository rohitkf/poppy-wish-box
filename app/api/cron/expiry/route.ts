import type { NextRequest } from "next/server";
import { sendEventReminders, sendExpiryReminders, todayIn } from "@/lib/push";
import { pruneEvents } from "@/lib/server-data";
import { currentSpaceId } from "@/lib/space";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * The daily morning job: pantry and calendar reminders, and deleting calendar events that ended
 * more than 90 days ago. Vercel Cron calls it each morning (vercel.json). With CRON_SECRET set,
 * Vercel sends it as a bearer token and nothing else is accepted. Without it the route stays open,
 * which is harmless: each phone gets at most one reminder of each kind a day, and the reply
 * carries no data. Elsewhere, call it from any scheduler:
 *   curl -H "Authorization: Bearer $CRON_SECRET" …/api/cron/expiry
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const spaceId = await currentSpaceId();
  if (!spaceId) return Response.json({ ok: true, sent: 0 });
  const today = todayIn();
  await pruneEvents(spaceId, today);
  const pantry = await sendExpiryReminders(spaceId, today);
  const events = await sendEventReminders(spaceId, today);
  return Response.json({ ok: true, sent: pantry.sent + events.sent }, { headers: { "Cache-Control": "no-store" } });
}
