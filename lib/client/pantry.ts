import type { PantryItem } from "@/lib/types";

export type Freshness = "expired" | "soon" | "fresh" | "undated";

export const PANTRY_CATEGORIES = [
  "Dairy",
  "Meat & fish",
  "Fruit & veg",
  "Bakery",
  "Frozen",
  "Drinks",
  "Snacks",
  "Tins & jars",
  "Sauces",
  "Grains & pasta",
  "Leftovers",
  "Other",
];

/** Weights and volumes: amounts you edit, not count down one at a time. */
export const MEASURES = ["g", "kg", "ml", "l"];

export const PANTRY_UNITS = ["", "pcs", "packs", "bottles", "cartons", "tins", "jars", "g", "kg", "ml", "l"];

/** Today's date as YYYY-MM-DD in the device's own time zone. */
export function todayISO(now = new Date()) {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Whole calendar days from `from` to `to` (both YYYY-MM-DD); negative when `to` is earlier. */
export function daysBetween(from: string, to: string) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

export function addDays(iso: string, n: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function addMonths(iso: string, n: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + n);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return d.toISOString().slice(0, 10);
}

export function daysLeft(item: Pick<PantryItem, "expires_on">, today: string) {
  return item.expires_on ? daysBetween(today, item.expires_on) : null;
}

export function freshness(item: Pick<PantryItem, "expires_on">, today: string, warnDays: number): Freshness {
  const left = daysLeft(item, today);
  if (left === null) return "undated";
  if (left < 0) return "expired";
  if (left <= warnDays) return "soon";
  return "fresh";
}

/** "Expired 2 days ago", "Expires today", "Tomorrow", "5 days left", "3 weeks left". */
export function expiryLabel(item: Pick<PantryItem, "expires_on">, today: string) {
  const left = daysLeft(item, today);
  if (left === null) return "No date";
  if (left < -1) return `Expired ${-left} days ago`;
  if (left === -1) return "Expired yesterday";
  if (left === 0) return "Expires today";
  if (left === 1) return "Expires tomorrow";
  if (left < 14) return `${left} days left`;
  if (left < 60) return `${Math.round(left / 7)} weeks left`;
  return `${Math.round(left / 30)} months left`;
}

/** Short badge: "−2d", "Today", "1d", "12d", "6w". */
export function expiryBadge(item: Pick<PantryItem, "expires_on">, today: string) {
  const left = daysLeft(item, today);
  if (left === null) return "—";
  if (left === 0) return "Today";
  if (left < 0) return `${left}d`;
  if (left < 14) return `${left}d`;
  if (left < 60) return `${Math.round(left / 7)}w`;
  return `${Math.round(left / 30)}mo`;
}

export function openedLabel(item: Pick<PantryItem, "opened_on">, today: string) {
  if (!item.opened_on) return null;
  const ago = daysBetween(item.opened_on, today);
  if (ago <= 0) return "Opened today";
  if (ago === 1) return "Opened yesterday";
  return `Opened ${ago} days ago`;
}

export function quantityLabel(item: Pick<PantryItem, "quantity" | "unit">) {
  if (item.quantity === null) return null;
  const q = Number.isInteger(item.quantity) ? String(item.quantity) : String(Number(item.quantity.toFixed(2)));
  if (!item.unit) return `× ${q}`;
  // "1 pack", not "1 packs" (weights and volumes stay as they are).
  const unit = item.quantity === 1 && !MEASURES.includes(item.unit) && item.unit.endsWith("s") && item.unit !== "pcs" ? item.unit.slice(0, -1) : item.unit;
  return `${q} ${unit}`;
}

const RANK: Record<Freshness, number> = { expired: 0, soon: 1, fresh: 2, undated: 3 };

/** Most urgent first: expired, then soonest dates, then items with no date. */
export function sortPantry(items: PantryItem[], today: string, warnDays: number) {
  return [...items].sort((a, b) => {
    const r = RANK[freshness(a, today, warnDays)] - RANK[freshness(b, today, warnDays)];
    if (r) return r;
    if (a.expires_on && b.expires_on && a.expires_on !== b.expires_on) return a.expires_on < b.expires_on ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

export function pantryCounts(items: PantryItem[], today: string, warnDays: number) {
  let expired = 0;
  let soon = 0;
  for (const i of items) {
    const f = freshness(i, today, warnDays);
    if (f === "expired") expired++;
    else if (f === "soon") soon++;
  }
  return { expired, soon };
}

// ─── Freezing ───────────────────────────────────────────────────────────────

/** A place counts as a freezer if it says so: "Freezer", "Garage freezer", "Chest freezer". */
export const isFreezer = (location: string | null | undefined) => !!location && /freez/i.test(location);

/**
 * Roughly how long food keeps well once frozen, by category (UK food-safety guidance: frozen food
 * stays safe, but quality drops after this). A suggestion only; the date can be changed.
 */
const FREEZER_MONTHS: Record<string, number> = {
  "Meat & fish": 3,
  Bakery: 3,
  Leftovers: 3,
  Dairy: 3,
  "Fruit & veg": 8,
  Frozen: 6,
  Sauces: 3,
  "Grains & pasta": 3,
};
export const freezerMonths = (category: string | null | undefined) => FREEZER_MONTHS[category ?? ""] ?? 3;

/** "Frozen 12 Nov", "Defrosted today" for the list. */
export function freezeLabel(item: Pick<PantryItem, "frozen_on" | "defrosted_on">, today: string) {
  const short = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
  if (item.defrosted_on) {
    const ago = daysBetween(item.defrosted_on, today);
    return ago <= 0 ? "Defrosted today" : ago === 1 ? "Defrosted yesterday" : `Defrosted ${short(item.defrosted_on)}`;
  }
  return item.frozen_on ? `Frozen ${short(item.frozen_on)}` : null;
}

/** "Pack 15 Nov" when the pack's date differs from the one the warnings use. */
export function packLabel(item: Pick<PantryItem, "package_expires_on" | "expires_on">) {
  if (!item.package_expires_on || item.package_expires_on === item.expires_on) return null;
  const d = new Date(`${item.package_expires_on}T00:00:00Z`);
  return `Pack ${d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })}`;
}
