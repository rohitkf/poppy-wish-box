"use client";

import { useMemo, useState } from "react";
import { Icon } from "@/components/icons";
import { addDays, addMonths, formatDate, KEEP_DAYS_AFTER, relativeDay } from "@/lib/calendar";
import { cn } from "@/lib/client/util";
import { EventCard, type CalItem } from "@/components/app/calendar/shared";

const RANGES = [1, 2, 3, 5];

/**
 * The default view: everything coming up, a month at a time, like a church events page.
 * Starts with the next 12 months; you can look further ahead, as far as you like.
 */
export function Upcoming({
  today,
  itemsIn,
  years,
  setYears,
  onOpen,
  onAdd,
}: {
  today: string;
  itemsIn: (from: string, to: string) => CalItem[];
  years: number;
  setYears: (n: number) => void;
  onOpen: (i: CalItem) => void;
  onAdd: () => void;
}) {
  const [past, setPast] = useState(false);
  const [custom, setCustom] = useState(!RANGES.includes(years));
  const from = past ? addDays(today, -KEEP_DAYS_AFTER) : today;
  const to = addDays(addMonths(today, 12 * years), -1);

  const months = useMemo(() => {
    const byDay = new Map<string, CalItem[]>();
    for (const it of itemsIn(from, to)) {
      // Something already under way shows on today; everything else on the day it starts.
      const day = it.start < from ? from : it.start < today && it.end >= today ? today : it.start;
      byDay.set(day, [...(byDay.get(day) ?? []), it]);
    }
    const out: { month: string; days: { day: string; items: CalItem[] }[] }[] = [];
    for (const day of [...byDay.keys()].sort()) {
      const month = day.slice(0, 7);
      if (out.at(-1)?.month !== month) out.push({ month, days: [] });
      out.at(-1)!.days.push({ day, items: byDay.get(day)! });
    }
    return out;
  }, [itemsIn, from, to, today]);

  const events = months.reduce((n, m) => n + m.days.reduce((k, d) => k + d.items.filter((i) => !i.holiday).length, 0), 0);

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-2 px-5 lg:px-0">
        <span className="text-[14px] text-ink-2">Show the next</span>
        <div className="flex gap-1.5" role="group" aria-label="How far ahead">
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
          <button
            type="button"
            aria-pressed={custom}
            onClick={() => setCustom(true)}
            className={cn("h-8 rounded-full px-3 text-[13px]", custom ? "bg-ink font-medium text-bg" : "border border-line-2 text-ink-2 hover:bg-sunken")}
          >
            Other
          </button>
        </div>
        {custom ? (
          <label className="flex items-center gap-1.5 text-[14px] text-ink-2">
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
              className="h-8 w-16 rounded-lg border border-line-2 bg-surface px-2 text-center text-[15px] tabular-nums outline-none focus:border-ink"
            />
            years
          </label>
        ) : null}
      </div>

      <button
        type="button"
        onClick={() => setPast(!past)}
        className="mx-5 mt-2 self-start text-[13px] font-semibold text-clay-ink lg:mx-0"
        aria-pressed={past}
      >
        {past ? "Hide past events" : `Show the last ${KEEP_DAYS_AFTER} days too`}
      </button>

      {events === 0 && !months.length ? (
        <div className="mx-5 mt-4 flex flex-col items-center gap-3 rounded-2xl border-[1.5px] border-dashed border-dash px-6 py-10 text-center lg:mx-0">
          <Icon.Calendar size={28} />
          <p className="max-w-[320px] text-[15px] text-ink-2">
            Nothing planned yet. Add days off, trips, appointments, tests and birthdays, and you&apos;ll both see them here.
          </p>
          <button type="button" onClick={onAdd} className="text-[14px] font-semibold text-clay-ink">
            Add the first event
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-6 pt-3">
          {months.map((m) => (
            <section key={m.month} aria-label={formatDate(`${m.month}-01`, "monthYear")}>
              <h2 className="sticky top-0 z-10 bg-bg/95 px-5 py-2 font-display text-[21px] font-semibold tracking-[-0.2px] backdrop-blur lg:px-0">
                {formatDate(`${m.month}-01`, "monthLong")}
                {m.month.slice(0, 4) !== today.slice(0, 4) ? <span className="text-ink-3"> {m.month.slice(0, 4)}</span> : null}
              </h2>
              <ol className="flex flex-col gap-3 px-3 lg:px-0">
                {m.days.map(({ day, items }) => {
                  const isToday = day === today;
                  return (
                    <li key={day} className="flex gap-3">
                      <div
                        className={cn(
                          "flex w-[52px] shrink-0 flex-col items-center rounded-[14px] py-1.5",
                          isToday ? "bg-clay text-on-clay" : day < today ? "text-ink-3" : "text-ink",
                        )}
                      >
                        <span className={cn("text-[11px] font-semibold tracking-[0.6px] uppercase", !isToday && "text-ink-3")}>
                          {formatDate(day, "weekdayShort")}
                        </span>
                        <span className="font-display text-[24px] leading-none font-semibold tabular-nums">{Number(day.slice(8))}</span>
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                        <span className={cn("text-[12px] font-medium", isToday ? "text-clay-ink" : "text-ink-3")}>{relativeDay(day, today)}</span>
                        {items.map((it) => (
                          <EventCard key={it.key} item={it} today={today} onOpen={onOpen} showDay={day} />
                        ))}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>
          ))}
        </div>
      )}

      <div className="mx-5 mt-6 flex flex-col items-center gap-2 border-t border-line-soft pt-5 text-center lg:mx-0">
        <p className="text-[13px] text-ink-3">
          Showing until {formatDate(to, "dayMonthYear")}. Past events are deleted {KEEP_DAYS_AFTER} days after they end.
        </p>
        {years < 25 ? (
          <button
            type="button"
            onClick={() => {
              setCustom(!RANGES.includes(years + 1));
              setYears(years + 1);
            }}
            className="h-10 rounded-[10px] border border-line-2 px-4 text-[14px] font-medium hover:bg-sunken"
          >
            Show another year
          </button>
        ) : null}
      </div>
    </div>
  );
}
