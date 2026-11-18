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
  occurrences,
  todayLocal,
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

export const HOLIDAY_COLOR = "var(--teal-text)";

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

/** Today, the events, the filters, and `itemsIn(from, to)` for the views. */
export function useCalendar(who: string = "all") {
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
    () => (who === "all" ? events : events.filter((e) => !e.who?.length || e.who.includes(who))),
    [events, who],
  );

  const itemsIn = useCallback(
    (from: string, to: string) => {
      const out: CalItem[] = [];
      for (const ev of shown) for (const o of occurrences(ev, from, to)) out.push(fromOcc(o));
      if (showHolidays) {
        const years: number[] = [];
        for (let y = Number(from.slice(0, 4)); y <= Number(to.slice(0, 4)); y++) years.push(y);
        for (const h of holidaysFor(years, official)) if (h.date >= from && h.date <= to) out.push(fromHoliday(h));
      }
      return out.sort(compareItems);
    },
    [shown, showHolidays, official],
  );

  return { today, events, itemsIn, members: data.space.member_names ?? [] };
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

/** One event in a list: the Upcoming view and a day's list under the month grid. */
export function EventCard({ item, today, onOpen, showDay }: { item: CalItem; today: string; onOpen: (i: CalItem) => void; showDay?: string }) {
  const ev = item.occ?.event as CalendarEvent | undefined;
  const days = daysBetween(item.start, item.end) + 1;
  // A trip that started before the day shown: "Day 3 of 7".
  const progress = showDay && days > 1 && showDay > item.start ? `Day ${daysBetween(item.start, showDay) + 1} of ${days}` : null;
  const when = item.holiday ? (item.holiday.substitute ? "Bank holiday (substitute day)" : "Bank holiday") : whenLabel(item.occ!);
  const past = item.end < today;
  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      className={cn("flex w-full min-w-0 items-stretch gap-3 rounded-[14px] text-left transition-opacity", past && "opacity-60")}
      style={{ background: tint(item.color, item.holiday ? 10 : 16) }}
    >
      <span className="w-1.5 shrink-0 rounded-l-[14px]" style={{ background: item.color }} aria-hidden />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5 py-2.5 pr-1">
        <span className="flex items-center gap-1.5">
          {item.holiday ? <Icon.Flag size={14} className="shrink-0 text-teal-text" /> : null}
          <span className="truncate text-[16px] font-semibold">{item.title}</span>
        </span>
        <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-[13px] text-ink-2">
          <span className="tabular-nums">{progress ?? when}</span>
          {ev?.location ? (
            <span className="flex min-w-0 items-center gap-0.5 truncate">
              <Icon.Location size={13} className="shrink-0" />
              <span className="truncate">{ev.location}</span>
            </span>
          ) : null}
          {ev && ev.repeat !== "none" ? <Icon.Repeat size={13} aria-label="Repeats" /> : null}
          {ev && ev.remind_days !== null ? <Icon.Bell size={13} aria-label="Reminder on" /> : null}
        </span>
      </span>
      <span className="flex shrink-0 items-center pr-3">
        <WhoDots who={item.who} />
      </span>
    </button>
  );
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

