"use client";

import { useMemo, useState } from "react";
import { Icon } from "@/components/icons";
import { addDays, addMonths, daysBetween, endOfMonth, formatDate, KEEP_DAYS_AFTER, relativeDay, startOfMonth, startOfWeek } from "@/lib/calendar";
import { cn } from "@/lib/client/util";
import { EventCard, type CalItem } from "@/components/app/calendar/shared";
import { WEEKDAYS } from "@/components/app/calendar/MonthView";

const RANGES = [1, 2, 3, 5];
const FIRST_PAGE = 10; // days
const NEXT_PAGE = 20;

type Day = { day: string; items: CalItem[] };

/** Groups items by the day they're listed on: the day they start, or `clamp` if already under way. */
function byDay(items: CalItem[], clamp: string) {
  const m = new Map<string, CalItem[]>();
  for (const it of items) {
    const day = it.start < clamp ? clamp : it.start;
    m.set(day, [...(m.get(day) ?? []), it]);
  }
  return [...m].map(([day, items]) => ({ day, items }));
}

/**
 * The default view, laid out like the church diary: a month at a glance with a dot for each
 * colour on a day, then "Coming up" a day at a time (ten days, then more on request), as far
 * ahead as you choose, and the last 90 days folded away underneath.
 */
export function Upcoming({
  today,
  itemsIn,
  years,
  setYears,
  onOpen,
  onAdd,
  onOpenDay,
}: {
  today: string;
  itemsIn: (from: string, to: string) => CalItem[];
  years: number;
  setYears: (n: number) => void;
  onOpen: (i: CalItem) => void;
  onAdd: (day?: string) => void;
  onOpenDay: (day: string) => void;
}) {
  const [custom, setCustom] = useState(!RANGES.includes(years));
  const [more, setMore] = useState(0);
  const [morePast, setMorePast] = useState(0);
  const to = addDays(addMonths(today, 12 * years), -1);

  const coming = useMemo(() => byDay(itemsIn(today, to), today).sort((a, b) => (a.day < b.day ? -1 : 1)), [itemsIn, today, to]);
  const past = useMemo(() => {
    const from = addDays(today, -KEEP_DAYS_AFTER);
    const ended = itemsIn(from, addDays(today, -1)).filter((i) => i.end < today && !i.holiday);
    return byDay(ended, from).sort((a, b) => (a.day < b.day ? 1 : -1));
  }, [itemsIn, today]);

  const shown = coming.slice(0, FIRST_PAGE + more);
  const left = coming.length - shown.length;
  const pastShown = past.slice(0, FIRST_PAGE + morePast);
  const pastCount = past.reduce((n, d) => n + d.items.length, 0);

  return (
    <div className="flex flex-col gap-8">
      <MiniMonth today={today} itemsIn={itemsIn} onDay={(day, busy) => (busy ? onOpenDay(day) : onAdd(day))} />

      <section aria-labelledby="coming-up" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-5 lg:px-0">
          <h2 id="coming-up" className="scroll-mt-4 font-display text-[24px] font-semibold tracking-[-0.3px]">
            Coming up
          </h2>
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="How far ahead">
            {RANGES.map((n) => (
              <button
                key={n}
                type="button"
                aria-pressed={!custom && years === n}
                onClick={() => {
                  setCustom(false);
                  setYears(n);
                }}
                className={cn(
                  "h-8 rounded-full px-3 text-[13px] tabular-nums",
                  !custom && years === n ? "bg-ink font-medium text-bg" : "border border-line-2 text-ink-2 hover:bg-sunken",
                )}
              >
                {n} {n === 1 ? "year" : "yrs"}
              </button>
            ))}
            {custom ? (
              <label className="flex h-8 items-center gap-1 rounded-full bg-ink pr-3 pl-1 text-[13px] font-medium text-bg">
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={25}
                  value={years}
                  onChange={(e) => {
                    const n = Math.round(Number(e.target.value));
                    if (n >= 1 && n <= 25) setYears(n);
                  }}
                  aria-label="Years ahead"
                  className="h-6 w-11 rounded-full bg-bg text-center text-[14px] text-ink tabular-nums outline-none"
                />
                yrs
              </label>
            ) : (
              <button type="button" onClick={() => setCustom(true)} className="h-8 rounded-full border border-line-2 px-3 text-[13px] text-ink-2 hover:bg-sunken">
                Other
              </button>
            )}
          </div>
        </div>

        {coming.length === 0 ? (
          <div className="mx-5 flex flex-col items-center gap-3 rounded-2xl border-[1.5px] border-dashed border-dash px-6 py-10 text-center lg:mx-0">
            <Icon.Calendar size={28} />
            <p className="max-w-[320px] text-[15px] text-ink-2">
              Nothing coming up. Add days off, trips, appointments, tests and birthdays, and you&apos;ll both see them here.
            </p>
            <button type="button" onClick={() => onAdd()} className="text-[14px] font-semibold text-clay-ink">
              Add an event
            </button>
          </div>
        ) : (
          <DiaryDays days={shown} today={today} onOpen={onOpen} />
        )}

        <div className="mx-5 flex flex-col items-center gap-2 pt-2 text-center lg:mx-0">
          {left > 0 ? (
            <button
              type="button"
              onClick={() => setMore(more + NEXT_PAGE)}
              className="h-11 rounded-[12px] border border-line-2 px-5 text-[14px] font-semibold hover:bg-sunken"
            >
              Show more · {left} more {left === 1 ? "day" : "days"} after {formatDate(shown.at(-1)!.day, "dayMonth")}
            </button>
          ) : coming.length ? (
            <p className="text-[13px] text-ink-3">That&apos;s everything until {formatDate(to, "dayMonthYear")}.</p>
          ) : null}
          {more > 0 ? (
            <button
              type="button"
              onClick={() => {
                setMore(0);
                document.getElementById("coming-up")?.scrollIntoView({ block: "start" });
              }}
              className="text-[13px] font-semibold text-clay-ink"
            >
              Show fewer
            </button>
          ) : null}
          {left === 0 && years < 25 ? (
            <button
              type="button"
              onClick={() => {
                setCustom(!RANGES.includes(years + 1));
                setYears(years + 1);
              }}
              className="text-[13px] font-semibold text-clay-ink"
            >
              Look another year ahead
            </button>
          ) : null}
        </div>
      </section>

      {past.length ? (
        <details className="group mx-5 rounded-2xl border border-line bg-surface lg:mx-0">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 [&::-webkit-details-marker]:hidden">
            <span className="flex flex-col">
              <span className="text-[16px] font-semibold">Past events · {pastCount}</span>
              <span className="text-[13px] text-ink-3">The last {KEEP_DAYS_AFTER} days, most recent first. Older ones are deleted.</span>
            </span>
            <Icon.Chevron size={18} className="shrink-0 text-ink-3 transition-transform group-open:rotate-180" />
          </summary>
          <div className="flex flex-col gap-3 pb-4">
            <DiaryDays days={pastShown} today={today} onOpen={onOpen} />
            {past.length > pastShown.length ? (
              <button type="button" onClick={() => setMorePast(morePast + NEXT_PAGE)} className="mx-auto h-10 rounded-[12px] border border-line-2 px-4 text-[14px] font-medium">
                Show more
              </button>
            ) : null}
          </div>
        </details>
      ) : null}
    </div>
  );
}

/** Days, each saying its date once and then what's on it. */
function DiaryDays({ days, today, onOpen }: { days: Day[]; today: string; onOpen: (i: CalItem) => void }) {
  return (
    <ol className="flex flex-col gap-4 px-3 lg:px-0">
      {days.map(({ day, items }, i) => {
        const isToday = day === today;
        const month = day.slice(0, 7);
        const newMonth = i === 0 || days[i - 1].day.slice(0, 7) !== month;
        return (
          <li key={day} className="flex flex-col gap-3">
            {newMonth ? (
              <h3 className="px-2 text-[12px] font-semibold tracking-[0.8px] text-ink-3 uppercase">
                {formatDate(`${month}-01`, month.slice(0, 4) === today.slice(0, 4) ? "monthLong" : "monthYear")}
              </h3>
            ) : null}
            <div className="flex gap-3">
              <div
                className={cn(
                  "flex w-[52px] shrink-0 flex-col items-center self-start rounded-[14px] py-1.5",
                  isToday ? "bg-clay text-on-clay" : day < today ? "text-ink-3" : "text-ink",
                )}
              >
                <span className={cn("text-[11px] font-semibold tracking-[0.6px] uppercase", !isToday && "text-ink-3")}>{formatDate(day, "weekdayShort")}</span>
                <span className="font-display text-[24px] leading-none font-semibold tabular-nums">{Number(day.slice(8))}</span>
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <span className={cn("text-[12px] font-medium", isToday ? "text-clay-ink" : "text-ink-3")}>
                  {isToday ? "Today" : `${formatDate(day, "full")} · ${relativeDay(day, today)}`}
                </span>
                {items.map((it) => (
                  <EventCard key={it.key} item={it} today={today} onOpen={onOpen} showDay={day} />
                ))}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** The church diary's month at a glance: a dot per colour on each day. */
function MiniMonth({ today, itemsIn, onDay }: { today: string; itemsIn: (from: string, to: string) => CalItem[]; onDay: (day: string, busy: boolean) => void }) {
  const [month, setMonth] = useState(() => startOfMonth(today));
  const gridStart = startOfWeek(month);
  const cells = Math.ceil((daysBetween(gridStart, endOfMonth(month)) + 1) / 7) * 7;
  const gridEnd = addDays(gridStart, cells - 1);
  const dots = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const it of itemsIn(gridStart, gridEnd)) {
      for (let d = it.start < gridStart ? gridStart : it.start; d <= it.end && d <= gridEnd; d = addDays(d, 1)) {
        const c = m.get(d) ?? [];
        if (!c.includes(it.color)) c.push(it.color);
        m.set(d, c);
      }
    }
    return m;
  }, [itemsIn, gridStart, gridEnd]);
  const nav = "flex h-9 min-w-9 items-center justify-center rounded-full border border-line-2 px-2.5 text-[14px] hover:bg-sunken";

  return (
    <section aria-label="Month at a glance" className="mx-3 rounded-2xl border border-line bg-surface p-3 sm:p-4 lg:mx-0">
      <div className="flex items-center justify-between gap-2 px-1">
        <h2 className="min-w-0 truncate font-display text-[20px] font-semibold">{formatDate(month, "monthYear")}</h2>
        <div className="flex shrink-0 items-center gap-1">
          <button type="button" onClick={() => setMonth(addMonths(month, -1))} aria-label="Previous month" className={nav}>
            <Icon.Back size={16} />
          </button>
          <button type="button" onClick={() => setMonth(startOfMonth(today))} className={nav}>
            Today
          </button>
          <button type="button" onClick={() => setMonth(addMonths(month, 1))} aria-label="Next month" className={nav}>
            <Icon.ChevronRight size={16} />
          </button>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-7">
        {WEEKDAYS.map((d) => (
          <span key={d} className="pb-1 text-center text-[11px] font-semibold tracking-[0.5px] text-ink-3 uppercase">
            {d}
          </span>
        ))}
        {Array.from({ length: cells }, (_, k) => {
          const day = addDays(gridStart, k);
          const inMonth = day.slice(0, 7) === month.slice(0, 7);
          const c = dots.get(day) ?? [];
          return (
            <button
              key={day}
              type="button"
              onClick={() => onDay(day, c.length > 0)}
              aria-label={c.length ? `${formatDate(day, "long")}: open the day` : `Add an event on ${formatDate(day, "long")}`}
              title={c.length ? "Open the day" : "Add an event"}
              className={cn("flex h-12 flex-col items-center gap-1 rounded-lg pt-1 hover:bg-sunken sm:h-14", !inMonth && "opacity-40")}
            >
              <span
                className={cn(
                  "flex h-6 w-6 items-center justify-center rounded-full text-[13px] tabular-nums",
                  day === today ? "bg-clay font-semibold text-on-clay" : "text-ink",
                )}
              >
                {Number(day.slice(8))}
              </span>
              <span className="flex h-1.5 gap-0.5" aria-hidden>
                {c.slice(0, 3).map((col) => (
                  <span key={col} className="h-1.5 w-1.5 rounded-full" style={{ background: col }} />
                ))}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
