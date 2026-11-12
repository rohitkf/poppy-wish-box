import "server-only";
import * as webpush from "web-push";
import { db } from "@/lib/db";

type Keys = { publicKey: string; privateKey: string };
let cached: Keys | null = null;

/**
 * The Web Push (VAPID) key pair. Generated on first use and kept in the database, like the
 * rest of the space, so reminders work without any extra environment variables.
 */
export async function vapidKeys(): Promise<Keys> {
  if (cached) return cached;
  const pool = db();
  await pool.query("insert into app_keys (name, value) values ('vapid', $1) on conflict (name) do nothing", [
    webpush.generateVAPIDKeys(),
  ]);
  const { rows } = await pool.query("select value from app_keys where name = 'vapid'");
  cached = rows[0].value as Keys;
  return cached;
}

/** Push services want a contact for the sender: the app's own address, or VAPID_SUBJECT. */
function subject() {
  if (process.env.VAPID_SUBJECT) return process.env.VAPID_SUBJECT;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return "https://github.com/rohitkf/poppy-wish-box";
}

/** Only real browser push services may be stored, so the server never posts to an arbitrary URL. */
const PUSH_HOSTS = ["fcm.googleapis.com", "push.services.mozilla.com", "push.apple.com", "notify.windows.com"];
export function isPushEndpoint(endpoint: unknown): endpoint is string {
  if (typeof endpoint !== "string" || endpoint.length > 1000) return false;
  try {
    const u = new URL(endpoint);
    return u.protocol === "https:" && PUSH_HOSTS.some((h) => u.hostname === h || u.hostname.endsWith(`.${h}`));
  } catch {
    return false;
  }
}

export interface Subscription {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface PushMessage {
  title: string;
  body: string;
  url: string;
  tag: string;
}

/** Sends one notification. Returns false when the subscription is gone and should be forgotten. */
export async function sendPush(sub: Subscription, msg: PushMessage): Promise<boolean> {
  const keys = await vapidKeys();
  try {
    await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, JSON.stringify(msg), {
      vapidDetails: { subject: subject(), publicKey: keys.publicKey, privateKey: keys.privateKey },
      TTL: 12 * 60 * 60,
      timeout: 10_000,
    });
    return true;
  } catch (e) {
    const status = (e as { statusCode?: number }).statusCode;
    if (status === 404 || status === 410) return false;
    console.error(JSON.stringify({ level: "warn", msg: "push failed", status, host: new URL(sub.endpoint).hostname }));
    return true;
  }
}

/** Today's date (YYYY-MM-DD) where the couple lives; APP_TIME_ZONE overrides the default. */
export function todayIn(timeZone = process.env.APP_TIME_ZONE || "Europe/London", now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);

function when(left: number) {
  if (left < -1) return `expired ${-left} days ago`;
  if (left === -1) return "expired yesterday";
  if (left === 0) return "today";
  if (left === 1) return "tomorrow";
  return `in ${left} days`;
}

/** The reminder for a space, or null when nothing is expired or close to its date. */
export async function expiryDigest(spaceId: string, today: string): Promise<PushMessage | null> {
  const pool = db();
  const { rows } = await pool.query(
    `select p.name, p.location, to_char(p.expires_on, 'YYYY-MM-DD') as expires_on
       from pantry_items p join spaces s on s.id = p.space_id
      where p.space_id = $1 and p.expires_on is not null and p.expires_on <= $2::date + s.expiry_warn_days
      order by p.expires_on, p.name`,
    [spaceId, today],
  );
  if (!rows.length) return null;
  const items = rows.map((r) => ({ ...r, left: daysBetween(today, r.expires_on) }));
  const expired = items.filter((i) => i.left < 0).length;
  const soon = items.length - expired;
  const title = [expired ? `${expired} expired` : null, soon ? `${soon} to use soon` : null].filter(Boolean).join(" · ");
  const shown = items.slice(0, 4).map((i) => `${i.name} (${i.location}, ${when(i.left)})`);
  const more = items.length > shown.length ? `, and ${items.length - shown.length} more` : "";
  return { title: `Pantry: ${title}`, body: shown.join(", ") + more, url: "/?view=pantry", tag: "ours-expiry" };
}

/** Sends today's reminder to every subscribed phone that hasn't had it yet. Safe to call repeatedly. */
export async function sendExpiryReminders(spaceId: string) {
  const today = todayIn();
  const msg = await expiryDigest(spaceId, today);
  if (!msg) return { sent: 0 };
  const pool = db();
  const { rows: subs } = await pool.query(
    `select endpoint, p256dh, auth from push_subscriptions
      where space_id = $1 and (last_notified_on is null or last_notified_on < $2::date)`,
    [spaceId, today],
  );
  let sent = 0;
  for (const sub of subs as Subscription[]) {
    // Claim the day first, so overlapping runs can't both send.
    const { rowCount } = await pool.query(
      `update push_subscriptions set last_notified_on = $2::date
        where endpoint = $1 and (last_notified_on is null or last_notified_on < $2::date)`,
      [sub.endpoint, today],
    );
    if (!rowCount) continue;
    if (await sendPush(sub, msg)) sent++;
    else await pool.query("delete from push_subscriptions where endpoint = $1", [sub.endpoint]);
  }
  return { sent };
}
