"use client";

import { useMemo } from "react";
import { addDays, addMonths, daysBetween, endOfMonth, formatDate, startOfWeek } from "@/lib/calendar";
import { cn } from "@/lib/client/util";
import { TONE_BG, TONE_TEXT, ToneKey, type CalItem, type Tone } from "@/components/app/calendar/shared";

/** Twelve small months; a dot for each colour on a day. Tap a day to open it. */
export function YearView({
  year,
  today,
  itemsIn,
  toneOf,
  holidays,
  onOpenDay,
  onOpenMonth,
}: {
  year: number;
  today: string;
  itemsIn: (from: string, to: string) => CalItem[];
  toneOf: (day: string) => Tone;
  holidays: boolean;
  onOpenDay: (day: string) => void;
  onOpenMonth: (month: string) => void;
}) {
  const from = `${year}-01-01`;
  const to = `${year}-12-31`;
  const byDay = useMemo(() => {
    const m = new Map<string, { colors: string[]; holiday: boolean; titles: string[] }>();
    for (const it of itemsIn(from, to)) {
      const last = it.end > to ? to : it.end;
      for (let d = it.start < from ? from : it.start; d <= last; d = addDays(d, 1)) {
        const e = m.get(d) ?? { colors: [], holiday: false, titles: [] };
        if (it.holiday) e.holiday = true;
        else if (!e.colors.includes(it.color)) e.colors.push(it.color);
        e.titles.push(it.title);
        m.set(d, e);
      }
    }
    return m;
  }, [itemsIn, from, to]);

  return (
    <div className="flex flex-col gap-3">
    <ToneKey holidays={holidays} className="px-5 lg:px-1" />
    <div className="grid grid-cols-2 gap-x-3 gap-y-5 px-3 sm:grid-cols-3 lg:grid-cols-4 lg:px-0">
      {Array.from({ length: 12 }, (_, i) => {
        const first = addMonths(from, i);
        const gridStart = startOfWeek(first);
        const cells = Math.ceil((daysBetween(gridStart, endOfMonth(first)) + 1) / 7) * 7;
        const month = first.slice(0, 7);
        return (
          <section key={month} aria-label={formatDate(first, "monthYear")} className="rounded-2xl border border-line bg-surface p-2">
            <button type="button" onClick={() => onOpenMonth(first)} className="px-1 pb-1 font-display text-[16px] font-semibold hover:text-clay-ink">
              {formatDate(first, "monthLong")}
            </button>
            <div className="grid grid-cols-7 text-center">
              {["M", "T", "W", "T", "F", "S", "S"].map((d, k) => (
                <span key={k} className={cn("text-[10px] font-semibold", k >= 5 ? "text-weekend" : "text-ink-3")}>
                  {d}
                </span>
              ))}
              {Array.from({ length: cells }, (_, k) => {
                const day = addDays(gridStart, k);
                if (day.slice(0, 7) !== month) return <span key={day} />;
                const info = byDay.get(day);
                const tone = toneOf(day);
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => onOpenDay(day)}
                    title={info?.titles.join(", ")}
                    aria-label={`${formatDate(day, "long")}${info ? `: ${info.titles.join(", ")}` : ""}`}
                    className="flex h-8 flex-col items-center justify-start pt-0.5"
                  >
                    <span
                      className={cn(
                        "flex h-5 w-5 items-center justify-center rounded-full text-[11px] tabular-nums",
                        day === today
                          ? "bg-clay font-semibold text-on-clay"
                          : tone
                            ? cn(TONE_BG[tone], TONE_TEXT[tone], day < today && "opacity-70")
                            : day < today
                              ? "text-ink-3"
                              : "text-ink",
                      )}
                    >
                      {Number(day.slice(8))}
                    </span>
                    <span className="flex h-1.5 gap-[2px]" aria-hidden>
                      {info?.colors.slice(0, 3).map((c) => <span key={c} className="h-1 w-1 rounded-full" style={{ background: c }} />)}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
    </div>
  );
}
