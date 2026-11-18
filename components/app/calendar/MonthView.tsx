"use client";

import { addDays, daysBetween, endOfMonth, formatDate, layoutRow, startOfMonth, startOfWeek } from "@/lib/calendar";
import { cn } from "@/lib/client/util";
import { EventCard, TONE_BG, TONE_TEXT, ToneKey, tint, type CalItem, type Tone } from "@/components/app/calendar/shared";

export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const BAR = 20; // px per lane
const TOP = 26; // room for the day number

/** A month grid with event bars; the chosen day's events are listed underneath. */
export function MonthView({
  cursor,
  today,
  selected,
  itemsIn,
  toneOf,
  holidays,
  onSelect,
  onOpen,
  onOpenDay,
  lanes,
}: {
  cursor: string;
  today: string;
  selected: string;
  itemsIn: (from: string, to: string) => CalItem[];
  toneOf: (day: string) => Tone;
  holidays: boolean;
  onSelect: (day: string) => void;
  onOpen: (i: CalItem) => void;
  onOpenDay: (day: string) => void;
  /** event rows per week before "+N more" */
  lanes: number;
}) {
  const first = startOfMonth(cursor);
  const gridStart = startOfWeek(first);
  const weeks = Math.ceil((daysBetween(gridStart, endOfMonth(cursor)) + 1) / 7);
  const gridEnd = addDays(gridStart, weeks * 7 - 1);
  // The React Compiler memoizes these.
  const items = itemsIn(gridStart, gridEnd);
  const dayItems = items.filter((i) => i.start <= selected && i.end >= selected);
  const month = cursor.slice(0, 7);

  return (
    <div className="flex flex-col gap-4">
      <div className="mx-3 overflow-hidden rounded-2xl border border-line bg-surface lg:mx-0" role="grid" aria-label={formatDate(first, "monthYear")}>
        <div className="grid grid-cols-7 border-b border-line" role="row">
          {WEEKDAYS.map((d, i) => (
            <div
              key={d}
              role="columnheader"
              className={cn("py-2 text-center text-[11px] font-semibold tracking-[0.6px] uppercase", i >= 5 ? "bg-weekend-soft text-weekend" : "text-ink-3")}
            >
              {d.slice(0, 1)}
              <span className="max-sm:hidden">{d.slice(1)}</span>
            </div>
          ))}
        </div>
        {Array.from({ length: weeks }, (_, w) => {
          const rowStart = addDays(gridStart, w * 7);
          const bars = layoutRow(items, rowStart);
          const shown = bars.filter((b) => b.lane < lanes);
          const hidden = Array.from({ length: 7 }, (_, c) => bars.filter((b) => b.lane >= lanes && b.col <= c && b.col + b.span > c).length);
          return (
            <div key={rowStart} role="row" className="relative grid grid-cols-7 border-b border-line last:border-b-0" style={{ minHeight: TOP + lanes * BAR + 18 }}>
              {Array.from({ length: 7 }, (_, c) => {
                const day = addDays(rowStart, c);
                const out = day.slice(0, 7) !== month;
                const isSel = day === selected;
                const tone = toneOf(day);
                return (
                  <button
                    key={day}
                    type="button"
                    role="gridcell"
                    aria-selected={isSel}
                    aria-label={`${formatDate(day, "long")}${hidden[c] ? `, ${hidden[c]} more` : ""}`}
                    onClick={() => (isSel ? onOpenDay(day) : onSelect(day))}
                    className={cn(
                      "relative flex flex-col items-center border-r border-line-soft pt-1 last:border-r-0",
                      tone ? TONE_BG[tone] : out && "bg-sunken/40",
                      out && "opacity-60",
                      isSel && "bg-highlight",
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-[13px] tabular-nums",
                        day === today ? "bg-clay font-semibold text-on-clay" : tone ? TONE_TEXT[tone] : out ? "text-ink-3" : "text-ink",
                      )}
                    >
                      {Number(day.slice(8))}
                    </span>
                    {hidden[c] ? <span className="absolute bottom-0.5 text-[11px] font-medium text-ink-3">+{hidden[c]}</span> : null}
                  </button>
                );
              })}
              {shown.map((b) => (
                <button
                  key={`${b.item.key}:${rowStart}`}
                  type="button"
                  onClick={() => onOpen(b.item)}
                  title={b.item.title}
                  className={cn(
                    "absolute flex items-center gap-1 overflow-hidden px-1.5 text-left text-[11px] leading-none font-medium whitespace-nowrap sm:text-[12px]",
                    b.before ? "rounded-l-none" : "rounded-l-[5px]",
                    b.after ? "rounded-r-none" : "rounded-r-[5px]",
                  )}
                  style={{
                    top: TOP + b.lane * BAR,
                    height: BAR - 3,
                    left: `calc(${(b.col / 7) * 100}% + ${b.before ? 0 : 2}px)`,
                    width: `calc(${(b.span / 7) * 100}% - ${(b.before ? 0 : 2) + (b.after ? 0 : 2)}px)`,
                    background: tint(b.item.color, b.item.holiday ? 18 : 26),
                    boxShadow: b.before ? undefined : `inset 3px 0 0 ${b.item.color}`,
                  }}
                >
                  {b.item.startTime && b.span === 1 ? <span className="text-ink-2 tabular-nums max-sm:hidden">{b.item.startTime}</span> : null}
                  <span className="truncate">{b.item.title}</span>
                </button>
              ))}
            </div>
          );
        })}
      </div>

      <ToneKey holidays={holidays} className="-mt-2 px-5 lg:px-1" />

      <section aria-label={formatDate(selected, "long")} className="flex flex-col gap-2 px-3 lg:px-0">
        <div className="flex items-baseline justify-between gap-3 px-2">
          <h2 className="font-display text-[19px] font-semibold">{formatDate(selected, selected.slice(0, 4) === today.slice(0, 4) ? "full" : "fullYear")}</h2>
          <button type="button" onClick={() => onOpenDay(selected)} className="text-[13px] font-semibold text-clay-ink">
            Open day
          </button>
        </div>
        {dayItems.length ? (
          dayItems.map((it) => <EventCard key={it.key} item={it} today={today} onOpen={onOpen} showDay={selected} />)
        ) : (
          <p className="px-2 pb-2 text-[14px] text-ink-3">Nothing on. Tap + to add something.</p>
        )}
      </section>
    </div>
  );
}
