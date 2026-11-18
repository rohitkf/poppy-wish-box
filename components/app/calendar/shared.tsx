"use client";

import { useQuery } from "@tanstack/react-query";
import { useCallback, useMemo, useSyncExternalStore } from "react";
import { Icon } from "@/components/icons";
import { Avatar } from "@/components/ui/bits";
import { useSpace } from "@/components/app/SpaceProvider";
import { useNow } from "@/lib/client/clock";
import { api } from "@/lib/client/store";
import { showToast } from "@/lib/client/toast";
import { cn, storage } from "@/lib/client/util";
import {
  addDays,
  compareOccurrences,
  daysBetween,
  formatDate,
  kindOf,
  occurrences,
  todayLocal,
  weekday,
  whenLabel,
  type Occurrence,
} from "@/lib/calendar";
import { holidaysFor, type Holiday } from "@/lib/holidays";
import type { CalendarEvent } from "@/lib/types";

// ─── Device preferences (kept in localStorage, shared between components) ──

const prefListeners = new Set<() => void>();
export function usePref<T extends string>(key: string, fallback: T): [T, (v: T) => void] {
  const value = useSyncExternalStore(
    (l) => {
      prefListeners.add(l);
      return () => prefListeners.delete(l);
    },
    () => (storage.get(key) as T | null) ?? fallback,
    () => fallback,
  );
  const set = useCallback(
    (v: T) => {
      storage.set(key, v === fallback ? null : v);
      prefListeners.forEach((l) => l());
    },
    [key, fallback],
  );
  return [value, set];
}

export const useShowHolidays = () => {
  const [v, set] = usePref<"on" | "off">("ours:cal-holidays", "on");
  return [v === "on", (on: boolean) => set(on ? "on" : "off")] as const;
};

// ─── What the views draw ────────────────────────────────────────────────────

export interface CalItem {
  key: string;
  start: string;
  end: string;
  title: string;
  color: string;
  startTime: string | null;
  endTime: string | null;
  who: string[];
  holiday?: Holiday;
  occ?: Occurrence;
}

export const HOLIDAY_COLOR = "var(--holiday)";

/** What kind of day it is, for colouring the date itself: a bank holiday, a weekend, or neither. */
export type Tone = "holiday" | "weekend" | null;
export const TONE_TEXT: Record<"holiday" | "weekend", string> = { holiday: "font-semibold text-holiday", weekend: "text-weekend" };
export const TONE_BG: Record<"holiday" | "weekend", string> = { holiday: "bg-holiday-soft", weekend: "bg-weekend-soft" };

// Bank holiday dates per year, worked out once (official list or rules) and reused by every view.
const holidayCache = new Map<string, Set<string>>();
function holidayDates(year: number, official: Official | undefined) {
  const key = `${year}:${official?.years.join(",") ?? ""}`;
  let set = holidayCache.get(key);
  if (!set) {
    set = new Set(holidaysFor([year], official).map((h) => h.date));
    holidayCache.set(key, set);
  }
  return set;
}

/** The small key under a grid: which colour is a bank holiday and which a weekend. */
export function ToneKey({ holidays, className }: { holidays: boolean; className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-ink-3", className)}>
      {holidays ? (
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-[4px] border border-holiday/40 bg-holiday-soft" aria-hidden />
          <span className="text-holiday">Bank holiday</span>
        </span>
      ) : null}
      <span className="flex items-center gap-1.5">
        <span className="h-3 w-3 rounded-[4px] border border-weekend/30 bg-weekend-soft" aria-hidden />
        <span className="text-weekend">Weekend</span>
      </span>
    </div>
  );
}

function fromOcc(o: Occurrence): CalItem {
  return {
    key: o.key,
    start: o.start,
    end: o.end,
    title: o.event.title,
    color: o.event.color,
    startTime: o.event.start_time,
    endTime: o.event.end_time,
    who: o.event.who ?? [],
    occ: o,
  };
}

function fromHoliday(h: Holiday): CalItem {
  return { key: `holiday:${h.date}:${h.title}`, start: h.date, end: h.date, title: h.title, color: HOLIDAY_COLOR, startTime: null, endTime: null, who: [], holiday: h };
}

export function compareItems(a: CalItem, b: CalItem) {
  if (a.holiday && !b.holiday && a.start === b.start) return -1;
  if (b.holiday && !a.holiday && a.start === b.start) return 1;
  if (a.occ && b.occ) return compareOccurrences(a.occ, b.occ);
  if (a.start !== b.start) return a.start < b.start ? -1 : 1;
  return a.title.localeCompare(b.title);
}

type Official = { years: number[]; holidays: Holiday[] };

/**
 * Today, the events, the filters, and `itemsIn(from, to)` for the views.
 * `who` narrows to one person's events; `show` to one type ("holiday" for bank holidays only).
 */
export function useCalendar(who: string = "all", show: string | null = null) {
  const { data } = useSpace();
  const now = useNow();
  const today = todayLocal(now ? new Date(now) : new Date());
  const events = useMemo(() => data.events ?? [], [data.events]);
  const [showHolidays] = useShowHolidays();
  const official = useQuery({
    queryKey: ["holidays"],
    queryFn: () => api<Official>("/api/holidays"),
    staleTime: 24 * 60 * 60 * 1000,
    gcTime: 30 * 24 * 60 * 60 * 1000,
    retry: 1,
  }).data;

  const shown = useMemo(
    () =>
      show === "holiday"
        ? []
        : events.filter((e) => (who === "all" || !e.who?.length || e.who.includes(who)) && (!show || e.kind === show)),
    [events, who, show],
  );
  const holidays = showHolidays && (!show || show === "holiday");

  const itemsIn = useCallback(
    (from: string, to: string) => {
      const out: CalItem[] = [];
      for (const ev of shown) for (const o of occurrences(ev, from, to)) out.push(fromOcc(o));
      if (holidays) {
        const years: number[] = [];
        for (let y = Number(from.slice(0, 4)); y <= Number(to.slice(0, 4)); y++) years.push(y);
        for (const h of holidaysFor(years, official)) if (h.date >= from && h.date <= to) out.push(fromHoliday(h));
      }
      return out.sort(compareItems);
    },
    [shown, holidays, official],
  );

  // Days are coloured whenever bank holidays are switched on, whatever the type filter shows.
  const toneOf = useCallback(
    (day: string): Tone => {
      if (showHolidays && holidayDates(Number(day.slice(0, 4)), official).has(day)) return "holiday";
      return weekday(day) >= 5 ? "weekend" : null;
    },
    [showHolidays, official],
  );

  return { today, events, itemsIn, toneOf, showHolidays, members: data.space.member_names ?? [] };
}

// ─── Pieces ─────────────────────────────────────────────────────────────────

/** Tinted card colour with a strong edge, readable in light and dark. */
export const tint = (color: string, amount = 16) => `color-mix(in srgb, ${color} ${amount}%, var(--surface))`;

export function openHoliday(h: Holiday) {
  showToast({ message: `${h.title}${h.substitute ? " (substitute day)" : ""}: bank holiday in England & Wales` });
}

export function WhoDots({ who, size = 20 }: { who: string[]; size?: number }) {
  const { data } = useSpace();
  if (!who.length) return null;
  return (
    <span className="flex shrink-0" aria-label={`For ${who.join(" and ")}`}>
      {who.slice(0, 3).map((n, i) => (
        <Avatar key={n} name={n} members={data.space.member_names} size={size} ring="var(--surface)" className={i ? "-ml-1.5" : undefined} />
      ))}
    </span>
  );
}

const REPEAT_CHIP = { weekly: "Weekly", monthly: "Monthly", yearly: "Yearly" } as const;

function Chip({ children, color }: { children: React.ReactNode; color?: string }) {
  return (
    <span
      className="shrink-0 rounded-full px-2 py-0.5 text-[11px] leading-[16px] font-semibold tracking-[0.3px] text-ink-2 uppercase"
      style={{ background: color ? `color-mix(in srgb, ${color} 22%, transparent)` : "var(--sunken)" }}
    >
      {children}
    </span>
  );
}

/**
 * One event in a list (the Upcoming list, a day under the month grid). Like the church diary:
 * the title, then chips for what it is, whether it repeats, and which day of a longer run this
 * is; notes where they can be read without opening it; and who added it.
 */
export function EventCard({ item, today, onOpen, showDay }: { item: CalItem; today: string; onOpen: (i: CalItem) => void; showDay?: string }) {
  const ev = item.occ?.event as CalendarEvent | undefined;
  const days = daysBetween(item.start, item.end) + 1;
  const past = item.end < today;
  // A trip on its third day says so, or the same name on seven days reads as seven events.
  // A repeat says it repeats instead: "Day 3 of 29" on a weekly class reads as one long one.
  const run =
    days > 1 && ev?.repeat === "none"
      ? `${past ? `${days} days` : showDay && showDay > item.start ? `Day ${daysBetween(item.start, showDay) + 1} of ${days}` : `${days} days`} · ${formatRange(item.start, item.end)}`
      : null;
  const when = item.holiday ? (item.holiday.substitute ? "Substitute day" : null) : item.startTime ? whenLabel(item.occ!) : days > 1 ? null : "All day";
  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      aria-label={`${item.title}: see the details`}
      className={cn("flex w-full min-w-0 items-stretch gap-3 rounded-[14px] text-left transition-opacity hover:opacity-90", past && "opacity-60")}
      style={{ background: tint(item.color, item.holiday ? 10 : 14) }}
    >
      <span className="w-1.5 shrink-0 rounded-l-[14px]" style={{ background: item.color }} aria-hidden />
      <span className="flex min-w-0 flex-1 flex-col gap-1 py-2.5 pr-1">
        <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          {item.holiday ? <Icon.Flag size={14} className="shrink-0 text-holiday" /> : null}
          <span className="min-w-0 text-[16px] font-semibold break-words">{item.title}</span>
          <Chip color={item.color}>{item.holiday ? "Bank holiday" : kindOf(ev!.kind).label}</Chip>
          {ev && ev.repeat !== "none" ? <Chip>{REPEAT_CHIP[ev.repeat]}</Chip> : null}
          {run ? <Chip>{run}</Chip> : null}
        </span>
        {when || ev?.location || ev?.remind_days != null ? (
          <span className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[13px] text-ink-2">
            {when ? (
              <span className="flex items-center gap-1 tabular-nums">
                {item.startTime ? <Icon.Clock size={13} className="shrink-0" /> : null}
                {when}
              </span>
            ) : null}
            {ev?.location ? (
              <span className="flex min-w-0 items-center gap-0.5">
                <Icon.Location size={13} className="shrink-0" />
                <span className="break-words">{ev.location}</span>
              </span>
            ) : null}
            {ev && ev.remind_days !== null ? (
              <span className="flex items-center gap-1">
                <Icon.Bell size={13} className="shrink-0" />
                {reminderLabel(ev.remind_days)}
              </span>
            ) : null}
          </span>
        ) : null}
        {ev?.notes ? <span className="line-clamp-3 text-[13px] whitespace-pre-line text-ink-2 break-words">{ev.notes}</span> : null}
        {ev?.added_by ? <span className="text-[12px] text-ink-3">Added by {ev.added_by}</span> : null}
      </span>
      <span className="flex shrink-0 items-start pt-2.5 pr-3">
        <WhoDots who={item.who} />
      </span>
    </button>
  );
}

/** "18–24 Dec", "28 Dec – 3 Jan 2027". */
export function formatRange(from: string, to: string) {
  if (from.slice(0, 7) === to.slice(0, 7)) return `${Number(from.slice(8))}–${formatDate(to, "dayMonth")}`;
  return `${formatDate(from, "dayMonth")} – ${formatDate(to, from.slice(0, 4) === to.slice(0, 4) ? "dayMonth" : "dayMonthYear")}`;
}

export function reminderLabel(days: number) {
  return days === 0 ? "Reminder on the day" : days === 1 ? "Reminder the day before" : days === 7 ? "Reminder a week before" : `Reminder ${days} days before`;
}

/** "Next up" on the lists home, for anything in the coming fortnight. */
export function NextUp({ onOpen }: { onOpen: () => void }) {
  const { today, itemsIn } = useCalendar();
  const next = useMemo(() => itemsIn(today, addDays(today, 14)).find((i) => !i.holiday), [itemsIn, today]);
  if (!next) return null;
  const day = next.start <= today ? "Today" : daysBetween(today, next.start) === 1 ? "Tomorrow" : formatDate(next.start, "full");
  const time = next.startTime && next.start >= today ? ` · ${next.startTime}` : "";
  return (
    <button type="button" onClick={onOpen} className="flex w-full items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-2.5 text-left">
      <span className="h-8 w-1.5 shrink-0 rounded-full" style={{ background: next.color }} aria-hidden />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-[12px] font-semibold tracking-[0.5px] text-ink-3 uppercase">Next up</span>
        <span className="truncate text-[15px] font-semibold">
          {next.title}
          <span className="font-normal text-ink-2">
            {" "}
            · {day}
            {time}
          </span>
        </span>
      </span>
      <Icon.ChevronRight size={18} className="text-ink-3" />
    </button>
  );
}

