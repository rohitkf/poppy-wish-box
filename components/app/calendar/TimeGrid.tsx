"use client";

import { useEffect, useMemo, useRef } from "react";
import { useNow } from "@/lib/client/clock";
import { addDays, formatDate, layoutDay, layoutRow, segmentOn } from "@/lib/calendar";
import { cn } from "@/lib/client/util";
import { tint, type CalItem } from "@/components/app/calendar/shared";

const HOUR = 48; // px
const LANE = 24;

/** Day view (one column) and week view (seven): an all-day strip over an hour grid. */
export function TimeGrid({
  start,
  days,
  today,
  itemsIn,
  onOpen,
  onOpenDay,
  onCreate,
}: {
  start: string;
  days: number;
  today: string;
  itemsIn: (from: string, to: string) => CalItem[];
  onOpen: (i: CalItem) => void;
  onOpenDay: (day: string) => void;
  onCreate: (day: string, time?: string) => void;
}) {
  const end = addDays(start, days - 1);
  const cols = useMemo(() => Array.from({ length: days }, (_, i) => addDays(start, i)), [start, days]);
  const items = useMemo(() => itemsIn(start, end), [itemsIn, start, end]);
  const allDay = useMemo(() => layoutRow(items.filter((i) => !i.startTime), start, days), [items, start, days]);
  const allDayLanes = Math.max(0, ...allDay.map((b) => b.lane + 1));
  const timed = useMemo(
    () =>
      cols.map((day) =>
        layoutDay(
          items
            .filter((i) => i.startTime && i.start <= day && i.end >= day)
            .map((i) => ({ item: i, ...segmentOn({ start: i.start, end: i.end, key: i.key, event: i.occ!.event }, day) })),
        ),
      ),
    [items, cols],
  );

  const now = useNow();
  const nowDate = now ? new Date(now) : null;
  const nowMin = nowDate ? nowDate.getHours() * 60 + nowDate.getMinutes() : null;

  // Open at 7am (or an hour before now, today), like other calendars.
  const gridRef = useRef<HTMLDivElement>(null);
  const scrolledFor = useRef<string | null>(null);
  useEffect(() => {
    if (scrolledFor.current === start || !gridRef.current) return;
    scrolledFor.current = start;
    const showsToday = today >= start && today <= end;
    const hour = showsToday && nowMin !== null ? Math.max(0, Math.floor(nowMin / 60) - 1) : 7;
    const top = gridRef.current.getBoundingClientRect().top + window.scrollY + hour * HOUR - 150;
    window.scrollTo({ top: Math.max(0, top) });
  }, [start, end, today, nowMin]);

  const colsStyle = { gridTemplateColumns: `44px repeat(${days}, minmax(0, 1fr))` };

  return (
    <div className="mx-3 rounded-2xl border border-line bg-surface lg:mx-0">
      <div className="sticky top-0 z-20 rounded-t-2xl border-b border-line bg-surface">
        <div className="grid" style={colsStyle}>
          <span />
          {cols.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => days > 1 && onOpenDay(d)}
              className="flex flex-col items-center py-1.5"
              aria-label={formatDate(d, "long")}
            >
              <span className="text-[11px] font-semibold tracking-[0.5px] text-ink-3 uppercase">{formatDate(d, "weekdayShort").slice(0, days > 1 ? 1 : 3)}</span>
              <span
                className={cn(
                  "flex h-7 min-w-7 items-center justify-center rounded-full px-1 text-[15px] font-semibold tabular-nums",
                  d === today && "bg-clay text-on-clay",
                )}
              >
                {Number(d.slice(8))}
              </span>
            </button>
          ))}
        </div>
        {allDayLanes ? (
          <div className="relative grid border-t border-line-soft" style={{ ...colsStyle, height: allDayLanes * LANE + 6 }}>
            <span className="self-center pl-1 text-[10px] text-ink-3">all day</span>
            <div className="relative" style={{ gridColumn: `2 / span ${days}` }}>
              {allDay.map((b) => (
                <button
                  key={b.item.key}
                  type="button"
                  onClick={() => onOpen(b.item)}
                  title={b.item.title}
                  className="absolute truncate rounded-[5px] px-1.5 text-left text-[12px] leading-[20px] font-medium"
                  style={{
                    top: 3 + b.lane * LANE,
                    height: LANE - 4,
                    left: `calc(${(b.col / days) * 100}% + 2px)`,
                    width: `calc(${(b.span / days) * 100}% - 4px)`,
                    background: tint(b.item.color, 26),
                    boxShadow: `inset 3px 0 0 ${b.item.color}`,
                  }}
                >
                  {b.item.title}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <div ref={gridRef} className="relative grid" style={{ ...colsStyle, height: 24 * HOUR }}>
        <div className="relative">
          {Array.from({ length: 23 }, (_, h) => (
            <span key={h} className="absolute right-1.5 -translate-y-1/2 text-[10px] text-ink-3 tabular-nums" style={{ top: (h + 1) * HOUR }}>
              {String(h + 1).padStart(2, "0")}:00
            </span>
          ))}
        </div>
        {cols.map((day, ci) => (
          <div
            key={day}
            className="relative border-l border-line-soft"
            onClick={(e) => {
              if (e.target !== e.currentTarget) return;
              const y = e.clientY - e.currentTarget.getBoundingClientRect().top;
              const h = Math.min(23, Math.max(0, Math.floor(y / HOUR)));
              onCreate(day, `${String(h).padStart(2, "0")}:00`);
            }}
          >
            {Array.from({ length: 23 }, (_, h) => (
              <span key={h} className="pointer-events-none absolute inset-x-0 border-t border-line-soft" style={{ top: (h + 1) * HOUR }} />
            ))}
            {day === today && nowMin !== null ? (
              <span className="pointer-events-none absolute inset-x-0 z-10 h-0.5 bg-danger" style={{ top: (nowMin / 60) * HOUR }}>
                <span className="absolute -top-[3px] -left-1 h-2 w-2 rounded-full bg-danger" />
              </span>
            ) : null}
            {timed[ci].map((p) => {
              const height = ((p.bottom - p.top) / 60) * HOUR;
              return (
                <button
                  key={p.item.key}
                  type="button"
                  onClick={() => onOpen(p.item)}
                  className="absolute flex flex-col overflow-hidden rounded-[6px] px-1.5 py-0.5 text-left text-[12px] leading-tight"
                  style={{
                    top: (p.top / 60) * HOUR + 1,
                    height: height - 2,
                    left: `calc(${(p.column / p.columns) * 100}% + 2px)`,
                    width: `calc(${100 / p.columns}% - 4px)`,
                    background: tint(p.item.color, 30),
                    boxShadow: `inset 3px 0 0 ${p.item.color}`,
                  }}
                >
                  <span className="truncate font-semibold">{p.item.title}</span>
                  {height > 34 ? (
                    <span className="truncate text-ink-2 tabular-nums">
                      {p.item.startTime}
                      {p.item.endTime ? `–${p.item.endTime}` : ""}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
