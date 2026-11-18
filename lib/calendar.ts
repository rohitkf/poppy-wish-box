// Calendar logic shared by the app and the server (reminders, clean-up). Dates are plain
// YYYY-MM-DD strings and times HH:MM, both in the couple's own time zone: no time zone maths.
import type { CalendarEvent, Repeat } from "@/lib/types";

// ─── Dates ──────────────────────────────────────────────────────────────────

const utc = (iso: string) => new Date(`${iso}T00:00:00Z`);
const fmt = (d: Date) => d.toISOString().slice(0, 10);

export function addDays(iso: string, n: number) {
  const d = utc(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return fmt(d);
}

/** Adds months, keeping the day where it can (31 Jan + 1 month = 28/29 Feb). */
export function addMonths(iso: string, n: number) {
  const d = utc(iso);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + n);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return fmt(d);
}

/** Whole days from `from` to `to`; negative when `to` is earlier. */
export function daysBetween(from: string, to: string) {
  return Math.round((utc(to).getTime() - utc(from).getTime()) / 86_400_000);
}

/** 0 = Monday … 6 = Sunday (UK weeks start on Monday). */
export function weekday(iso: string) {
  return (utc(iso).getUTCDay() + 6) % 7;
}

export const startOfWeek = (iso: string) => addDays(iso, -weekday(iso));
export const startOfMonth = (iso: string) => `${iso.slice(0, 7)}-01`;
export const endOfMonth = (iso: string) => addDays(addMonths(startOfMonth(iso), 1), -1);
export const startOfYear = (iso: string) => `${iso.slice(0, 4)}-01-01`;

export function todayLocal(now = new Date()) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

export function isDate(v: unknown): v is string {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && fmt(utc(v)) === v;
}

const dtf = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", ...opts });
const F = {
  weekdayShort: dtf({ weekday: "short" }),
  weekdayLong: dtf({ weekday: "long" }),
  monthLong: dtf({ month: "long" }),
  monthShort: dtf({ month: "short" }),
  monthYear: dtf({ month: "long", year: "numeric" }),
  dayMonth: dtf({ day: "numeric", month: "short" }),
  dayMonthYear: dtf({ day: "numeric", month: "short", year: "numeric" }),
  full: dtf({ weekday: "short", day: "numeric", month: "short" }),
  fullYear: dtf({ weekday: "short", day: "numeric", month: "short", year: "numeric" }),
  long: dtf({ weekday: "long", day: "numeric", month: "long", year: "numeric" }),
};
export type DateFormat = keyof typeof F;
export const formatDate = (iso: string, f: DateFormat) => F[f].format(utc(iso));

/** "Today", "Tomorrow", "Yesterday", "In 5 days", "In 3 weeks", "In 4 months", "2 days ago". */
export function relativeDay(iso: string, today: string) {
  const n = daysBetween(today, iso);
  if (n === 0) return "Today";
  if (n === 1) return "Tomorrow";
  if (n === -1) return "Yesterday";
  if (n < 0) return `${-n} days ago`;
  if (n < 14) return `In ${n} days`;
  if (n < 60) return `In ${Math.round(n / 7)} weeks`;
  if (n < 730) return `In ${Math.round(n / 30.4)} months`;
  return `In ${Math.round(n / 365.25)} years`;
}

/** "09:30" stays "09:30"; minutes since midnight for layout. */
export const minutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

// ─── Kinds and colours ──────────────────────────────────────────────────────

export const EVENT_COLORS = [
  { hex: "#d14b3a", name: "Tomato" },
  { hex: "#e0708a", name: "Flamingo" },
  { hex: "#e8803a", name: "Tangerine" },
  { hex: "#d9a520", name: "Banana" },
  { hex: "#4caf7d", name: "Sage" },
  { hex: "#2e7d4f", name: "Basil" },
  { hex: "#1e96c8", name: "Peacock" },
  { hex: "#4a5fc1", name: "Blueberry" },
  { hex: "#8a8fd8", name: "Lavender" },
  { hex: "#8e44ad", name: "Grape" },
  { hex: "#b4532a", name: "Clay" },
  { hex: "#6b6259", name: "Graphite" },
];

export interface EventKind {
  key: string;
  label: string;
  color: string;
  allDay: boolean;
  repeat?: Repeat;
}

export const EVENT_KINDS: EventKind[] = [
  { key: "day_off", label: "Day off", color: "#4caf7d", allDay: true },
  { key: "travel", label: "Travel", color: "#1e96c8", allDay: true },
  { key: "appointment", label: "Appointment", color: "#8a8fd8", allDay: false },
  { key: "test", label: "Test or exam", color: "#e8803a", allDay: false },
  { key: "birthday", label: "Birthday", color: "#e0708a", allDay: true, repeat: "yearly" },
  { key: "plans", label: "Plans", color: "#8e44ad", allDay: false },
  { key: "work", label: "Work", color: "#6b6259", allDay: false },
  { key: "other", label: "Other", color: "#4a5fc1", allDay: true },
];
export const kindOf = (key: string) => EVENT_KINDS.find((k) => k.key === key) ?? EVENT_KINDS[EVENT_KINDS.length - 1];

export const REMINDERS = [
  { days: 0, label: "On the day", note: "on the morning itself" },
  { days: 1, label: "1 day", note: "the morning before" },
  { days: 7, label: "1 week", note: "a week before" },
];

// ─── Repeats ────────────────────────────────────────────────────────────────

type EventLike = Pick<CalendarEvent, "id" | "start_date" | "end_date" | "repeat" | "repeat_until" | "skip_dates"> & Partial<CalendarEvent>;

export interface Occurrence<E extends EventLike = CalendarEvent> {
  /** event id + start date: unique per occurrence */
  key: string;
  event: E;
  start: string;
  end: string;
}

function nth(ev: EventLike, k: number) {
  if (ev.repeat === "weekly") return addDays(ev.start_date, 7 * k);
  if (ev.repeat === "monthly") return addMonths(ev.start_date, k);
  return addMonths(ev.start_date, 12 * k);
}

/** Every time `ev` happens that overlaps from…to (inclusive), in order. */
export function occurrences<E extends EventLike>(ev: E, from: string, to: string): Occurrence<E>[] {
  const span = Math.max(0, daysBetween(ev.start_date, ev.end_date));
  const out: Occurrence<E>[] = [];
  if (!ev.repeat || ev.repeat === "none") {
    if (ev.end_date >= from && ev.start_date <= to) out.push({ key: `${ev.id}:${ev.start_date}`, event: ev, start: ev.start_date, end: ev.end_date });
    return out;
  }
  // Jump close to `from` rather than walking from the first date.
  const gap = daysBetween(ev.start_date, from) - span;
  let k = 0;
  if (gap > 0) {
    if (ev.repeat === "weekly") k = Math.floor(gap / 7);
    else if (ev.repeat === "monthly") k = Math.max(0, Math.floor(gap / 31) - 1);
    else k = Math.max(0, Math.floor(gap / 366) - 1);
  }
  const skip = new Set(ev.skip_dates ?? []);
  for (let guard = 0; guard < 20_000; guard++, k++) {
    const start = nth(ev, k);
    if (start > to || (ev.repeat_until && start > ev.repeat_until)) break;
    const end = addDays(start, span);
    if (end >= from && !skip.has(start)) out.push({ key: `${ev.id}:${start}`, event: ev, start, end });
  }
  return out;
}

/** The last day an event happens on, or null if it repeats for ever. */
export function lastDay(ev: EventLike): string | null {
  if (!ev.repeat || ev.repeat === "none") return ev.end_date;
  if (!ev.repeat_until) return null;
  const all = occurrences({ ...ev, skip_dates: [] }, addDays(ev.repeat_until, -400), ev.repeat_until);
  return all.length ? all[all.length - 1].end : ev.end_date;
}

/** Events are kept for this long after they're over, then deleted to save space. */
export const KEEP_DAYS_AFTER = 90;

export function repeatLabel(ev: Pick<CalendarEvent, "repeat" | "repeat_until" | "start_date">) {
  if (ev.repeat === "none") return null;
  const base =
    ev.repeat === "weekly"
      ? `Every ${formatDate(ev.start_date, "weekdayLong")}`
      : ev.repeat === "monthly"
        ? `Monthly on the ${ordinal(Number(ev.start_date.slice(8)))}`
        : `Every year on ${formatDate(ev.start_date, "dayMonth")}`;
  return ev.repeat_until ? `${base}, until ${formatDate(ev.repeat_until, "dayMonthYear")}` : base;
}

export function ordinal(n: number) {
  const s = n % 100 >= 11 && n % 100 <= 13 ? "th" : (["th", "st", "nd", "rd"][n % 10] ?? "th");
  return `${n}${s}`;
}

/** "All day", "09:30", "09:30–11:00", "18 Dec – 2 Jan", "Fri 18 Dec, 22:00 – Sat 06:30". */
export function whenLabel(o: { start: string; end: string; event: Pick<CalendarEvent, "start_time" | "end_time"> }) {
  const { start_time: st, end_time: et } = o.event;
  const days = daysBetween(o.start, o.end) + 1;
  if (!st) {
    if (days === 1) return "All day";
    const sameYear = o.start.slice(0, 4) === o.end.slice(0, 4);
    return `${formatDate(o.start, sameYear ? "dayMonth" : "dayMonthYear")} – ${formatDate(o.end, "dayMonthYear")} · ${days} days`;
  }
  if (days === 1) return et ? `${st}–${et}` : st;
  return `${formatDate(o.start, "full")}, ${st} – ${formatDate(o.end, "full")}${et ? `, ${et}` : ""}`;
}

/** Ordering within a day: all-day and longer first, then by time, then title. */
export function compareOccurrences(a: Occurrence<EventLike>, b: Occurrence<EventLike>) {
  if (a.start !== b.start) return a.start < b.start ? -1 : 1;
  const at = a.event.start_time ?? "";
  const bt = b.event.start_time ?? "";
  if (!at !== !bt) return at ? 1 : -1;
  if (!at) {
    const d = daysBetween(b.start, b.end) - daysBetween(a.start, a.end);
    if (d) return d;
  }
  if (at !== bt) return at < bt ? -1 : 1;
  return (a.event.title ?? "").localeCompare(b.event.title ?? "");
}

// ─── Layout ─────────────────────────────────────────────────────────────────

export interface Bar<T> {
  item: T;
  /** first column (0-based) and how many columns it covers */
  col: number;
  span: number;
  lane: number;
  /** it continues from before the row / past its end */
  before: boolean;
  after: boolean;
}

/**
 * Lays out items spanning start…end into lanes across a row of `cols` days starting at
 * `rowStart` (a week row in the month grid, or the all-day strip in week view).
 */
export function layoutRow<T extends { start: string; end: string }>(items: T[], rowStart: string, cols = 7): Bar<T>[] {
  const rowEnd = addDays(rowStart, cols - 1);
  const inRow = items
    .filter((i) => i.end >= rowStart && i.start <= rowEnd)
    .sort((a, b) => (a.start !== b.start ? (a.start < b.start ? -1 : 1) : daysBetween(b.start, b.end) - daysBetween(a.start, a.end)));
  const lanes: number[] = []; // last column used in each lane
  return inRow.map((item) => {
    const col = Math.max(0, daysBetween(rowStart, item.start));
    const last = Math.min(cols - 1, daysBetween(rowStart, item.end));
    let lane = lanes.findIndex((end) => end < col);
    if (lane === -1) lane = lanes.push(-1) - 1;
    lanes[lane] = last;
    return { item, col, span: last - col + 1, lane, before: item.start < rowStart, after: item.end > rowEnd };
  });
}

export interface Placed<T> {
  item: T;
  top: number; // minutes from midnight
  bottom: number;
  column: number;
  columns: number;
}

/** Side-by-side columns for overlapping timed events in one day. */
export function layoutDay<T>(items: { item: T; top: number; bottom: number }[]): Placed<T>[] {
  const sorted = [...items].sort((a, b) => a.top - b.top || b.bottom - a.bottom);
  const out: Placed<T>[] = [];
  let cluster: Placed<T>[] = [];
  let clusterEnd = -1;
  const close = () => {
    const n = Math.max(1, ...cluster.map((p) => p.column + 1));
    cluster.forEach((p) => (p.columns = n));
    cluster = [];
  };
  for (const it of sorted) {
    if (it.top >= clusterEnd) close();
    const used = new Set(cluster.filter((p) => p.bottom > it.top).map((p) => p.column));
    let column = 0;
    while (used.has(column)) column++;
    const p = { ...it, column, columns: 1 };
    cluster.push(p);
    out.push(p);
    clusterEnd = Math.max(clusterEnd, it.bottom);
  }
  close();
  return out;
}

/** The part of a timed occurrence that falls on `day`, in minutes (an overnight trip spans two days). */
export function segmentOn(o: Occurrence<EventLike>, day: string) {
  const st = o.event.start_time ? minutes(o.event.start_time) : 0;
  let et = o.event.end_time ? minutes(o.event.end_time) : null;
  if (et === null || (o.start === o.end && et <= st)) et = Math.min(24 * 60, st + 60);
  const top = day === o.start ? st : 0;
  const bottom = day === o.end ? et : 24 * 60;
  return { top, bottom: Math.max(bottom, top + 20) };
}
