import type { Item } from "@/lib/types";

const DAY = 86_400_000;

export function relativeTime(iso: string | null | undefined, now = Date.now()) {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  const diff = Math.max(0, now - t);
  if (diff < 45_000) return "just now";
  if (diff < 3_600_000) return `${Math.round(diff / 60_000)}m`;
  if (diff < DAY && new Date(t).getDate() === new Date(now).getDate()) return `${Math.round(diff / 3_600_000)}h`;
  if (diff < 2 * DAY) return "yesterday";
  if (diff < 7 * DAY) return new Date(t).toLocaleDateString("en-GB", { weekday: "short" });
  return shortDate(iso);
}

export function shortDate(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", ...(sameYear ? {} : { year: "numeric" }) });
}

/** Target dates: "Sat 10 Oct" this year, "May 2027" when far out. */
export function targetDate(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(`${iso}T12:00:00`);
  const months = (d.getTime() - Date.now()) / (30 * DAY);
  if (months > 5) return d.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}

export function money(price: number | null | undefined, currency: string | null | undefined) {
  if (price === null || price === undefined) return "";
  if (price === 0) return "Free";
  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: currency || "GBP",
      maximumFractionDigits: Number.isInteger(price) ? 0 : 2,
    }).format(price);
  } catch {
    return `${price} ${currency ?? ""}`.trim();
  }
}

export function domain(url: string | null | undefined) {
  if (!url) return "";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function initial(name: string | null | undefined) {
  return (name?.trim()[0] ?? "?").toUpperCase();
}

export function mapsLink(location: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`;
}

export function activityLine(item: Item, me: string | null) {
  const who = item.updated_by && item.updated_by === me ? "You" : item.updated_by || item.added_by || "Someone";
  const initialOrYou = who === "You" ? "You" : initial(who);
  let verb = "edited";
  if (item.done_at && Math.abs(new Date(item.done_at).getTime() - new Date(item.updated_at).getTime()) < 2000) {
    verb = "marked";
    return `${initialOrYou} ${verb} “${item.title}” done`;
  }
  if (Math.abs(new Date(item.created_at).getTime() - new Date(item.updated_at).getTime()) < 2000) verb = "added";
  return `${initialOrYou} ${verb} “${item.title}”`;
}
