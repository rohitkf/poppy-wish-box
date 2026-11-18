"use client";

import { useState, useSyncExternalStore } from "react";
import { Icon } from "@/components/icons";
import { HereIndicator, Logo } from "@/components/ui/bits";
import { useSpace } from "@/components/app/SpaceProvider";
import { AppTabs } from "@/components/app/AppTabs";
import { useNav } from "@/lib/client/nav";
import { addDays, addMonths, EVENT_KINDS, formatDate, startOfWeek } from "@/lib/calendar";
import { cn } from "@/lib/client/util";
import { HOLIDAY_COLOR, openHoliday, usePref, useCalendar, useShowHolidays, type CalItem } from "@/components/app/calendar/shared";
import { EventDetails } from "@/components/app/calendar/EventDetails";
import { Upcoming } from "@/components/app/calendar/Upcoming";
import { MonthView } from "@/components/app/calendar/MonthView";
import { TimeGrid } from "@/components/app/calendar/TimeGrid";
import { YearView } from "@/components/app/calendar/YearView";
import { EventEditor, type Draft } from "@/components/app/calendar/EventEditor";
import type { CalendarEvent } from "@/lib/types";

type Mode = "upcoming" | "day" | "week" | "month" | "year";
const MODES: { value: Mode; label: string }[] = [
  { value: "upcoming", label: "List" },
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "year", label: "Year" },
];

function useWide() {
  return useSyncExternalStore(
    (cb) => {
      const mq = matchMedia("(min-width: 640px)");
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => matchMedia("(min-width: 640px)").matches,
    () => false,
  );
}

type Editing = { event?: CalendarEvent; occurrence?: string; draft?: Draft } | null;

export function Calendar() {
  const { here } = useSpace();
  const { go } = useNav();
  const [who, setWho] = useState("all");
  const [kind, setKind] = useState<string | null>(null);
  const { today, itemsIn, members, events } = useCalendar(who, kind);
  const [showHolidays] = useShowHolidays();
  const [reading, setReading] = useState<{ event: CalendarEvent; occurrence: string } | null>(null);
  const [yearsPref, setYearsPref] = usePref<string>("ours:cal-years", "1");
  const years = Math.min(25, Math.max(1, Number(yearsPref) || 1));
  const [mode, setMode] = useState<Mode>("upcoming");
  const [cursor, setCursor] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [editing, setEditing] = useState<Editing>(null);
  const wide = useWide();
  const at = cursor ?? today;
  const sel = selected ?? at;

  const step = (dir: 1 | -1) => {
    const next =
      mode === "day" ? addDays(at, dir) : mode === "week" ? addDays(at, 7 * dir) : mode === "month" ? addMonths(`${at.slice(0, 7)}-01`, dir) : addMonths(`${at.slice(0, 4)}-01-01`, 12 * dir);
    setCursor(next);
    if (mode === "month") setSelected(next.slice(0, 7) === today.slice(0, 7) ? today : next);
  };
  const show = (m: Mode, day?: string) => {
    setMode(m);
    if (day) {
      setCursor(day);
      setSelected(day);
    }
  };

  const open = (i: CalItem) => {
    if (i.holiday) return openHoliday(i.holiday);
    if (i.occ) setReading({ event: i.occ.event, occurrence: i.occ.start });
  };
  const add = (day?: string, time?: string) => setEditing({ draft: { date: day ?? (mode === "upcoming" ? today : sel), time } });

  const weekStart = startOfWeek(at);
  const title =
    mode === "day"
      ? formatDate(at, at.slice(0, 4) === today.slice(0, 4) ? "full" : "fullYear")
      : mode === "week"
        ? `${formatDate(weekStart, "dayMonth")} – ${formatDate(addDays(weekStart, 6), "dayMonthYear")}`
        : mode === "month"
          ? formatDate(`${at.slice(0, 7)}-01`, "monthYear")
          : at.slice(0, 4);
  const onToday =
    mode === "day" ? at === today : mode === "week" ? weekStart === startOfWeek(today) : mode === "month" ? at.slice(0, 7) === today.slice(0, 7) : at.slice(0, 4) === today.slice(0, 4);

  const chip = (on: boolean) =>
    cn("h-9 shrink-0 rounded-full px-3.5 text-[14px] whitespace-nowrap transition-colors", on ? "bg-ink font-medium text-bg" : "border border-line-2 text-ink hover:bg-sunken");

  return (
    <div className="flex min-h-full flex-col pb-32 lg:mx-auto lg:w-full lg:max-w-[1000px] lg:px-10 lg:pb-12">
      <header className="flex items-center justify-between px-5 pt-5 pb-2 safe-top lg:hidden">
        <div className="flex items-center gap-2">
          <Logo />
          <span className="font-display text-[22px] font-semibold">Ours</span>
        </div>
        <div className="flex items-center gap-2.5">
          <HereIndicator here={here} />
          <button type="button" onClick={() => go({ view: "settings" })} aria-label="Settings" className="flex h-10 w-10 items-center justify-center rounded-xl hover:bg-sunken">
            <Icon.Settings />
          </button>
        </div>
      </header>
      <AppTabs />

      <div className="flex flex-col gap-3 px-5 pt-3 lg:px-0 lg:pt-10">
        <div className="flex items-center justify-between gap-3">
          <h1 className="font-display text-[36px] font-semibold tracking-[-0.5px] lg:text-[38px]">Calendar</h1>
          <button
            type="button"
            onClick={() => add()}
            className="hidden h-10 items-center gap-1.5 rounded-[10px] bg-clay px-4 text-[14px] font-semibold text-on-clay lg:flex"
          >
            <Icon.Plus size={18} /> Add event
          </button>
        </div>
        <div role="tablist" aria-label="Calendar view" className="grid grid-cols-5 gap-1 rounded-xl bg-sunken p-1">
          {MODES.map((m) => (
            <button
              key={m.value}
              type="button"
              role="tab"
              aria-selected={mode === m.value}
              onClick={() => show(m.value)}
              className={cn(
                "h-9 truncate rounded-[9px] px-1 text-[14px] transition-colors",
                mode === m.value ? "bg-surface font-semibold shadow-sm" : "font-medium text-ink-2 hover:text-ink",
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
        {mode !== "upcoming" ? (
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => step(-1)} aria-label="Previous" className="flex h-10 w-10 items-center justify-center rounded-xl border border-line-2 hover:bg-sunken">
              <Icon.Back size={18} />
            </button>
            <button type="button" onClick={() => step(1)} aria-label="Next" className="flex h-10 w-10 items-center justify-center rounded-xl border border-line-2 hover:bg-sunken">
              <Icon.ChevronRight size={18} />
            </button>
            <h2 className="min-w-0 flex-1 truncate font-display text-[20px] font-semibold" aria-live="polite">
              {title}
            </h2>
            {!onToday ? (
              <button
                type="button"
                onClick={() => {
                  setCursor(null);
                  setSelected(null);
                }}
                className="h-10 rounded-xl border border-line-2 px-3 text-[14px] font-medium hover:bg-sunken"
              >
                Today
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-2 px-5 pt-3 pb-4 lg:px-0">
        {members.length > 1 ? (
          <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 lg:mx-0 lg:px-0" role="group" aria-label="Whose">
            <button type="button" aria-pressed={who === "all"} onClick={() => setWho("all")} className={chip(who === "all")}>
              Both of us
            </button>
            {members.map((m) => (
              <button key={m} type="button" aria-pressed={who === m} onClick={() => setWho(who === m ? "all" : m)} className={chip(who === m)}>
                {m}
              </button>
            ))}
          </div>
        ) : null}
        {/* The legend is the filter, as in the church diary: each type's dot and name. */}
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Show">
          {[
            { key: null, label: "Everything", color: null },
            ...EVENT_KINDS.filter((k) => k.key === kind || events.some((e) => e.kind === k.key)).map((k) => ({ key: k.key, label: k.label, color: k.color })),
            ...(showHolidays ? [{ key: "holiday", label: "Bank holidays", color: HOLIDAY_COLOR }] : []),
          ].map((k) => {
            const on = kind === k.key;
            return (
              <button
                key={k.key ?? "all"}
                type="button"
                aria-pressed={on}
                onClick={() => setKind(on ? null : k.key)}
                className={cn(
                  "inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px] transition-colors",
                  on ? "bg-ink font-medium text-bg" : "bg-sunken text-ink-2 hover:text-ink",
                )}
              >
                {k.color ? <span className="h-2 w-2 rounded-full" style={{ background: k.color }} aria-hidden /> : null}
                {k.label}
              </button>
            );
          })}
        </div>
      </div>

      {mode === "upcoming" ? (
        <Upcoming
          today={today}
          itemsIn={itemsIn}
          years={years}
          setYears={(n) => setYearsPref(String(n))}
          onOpen={open}
          onAdd={(d) => add(d)}
          onOpenDay={(d) => show("day", d)}
        />
      ) : mode === "month" ? (
        <MonthView
          cursor={at}
          today={today}
          selected={sel.slice(0, 7) === at.slice(0, 7) ? sel : `${at.slice(0, 7)}-01`}
          itemsIn={itemsIn}
          onSelect={setSelected}
          onOpen={open}
          onOpenDay={(d) => show("day", d)}
          lanes={wide ? 4 : 3}
        />
      ) : mode === "week" ? (
        <TimeGrid start={weekStart} days={7} today={today} itemsIn={itemsIn} onOpen={open} onOpenDay={(d) => show("day", d)} onCreate={add} />
      ) : mode === "day" ? (
        <TimeGrid start={at} days={1} today={today} itemsIn={itemsIn} onOpen={open} onOpenDay={() => {}} onCreate={add} />
      ) : (
        <YearView year={Number(at.slice(0, 4))} today={today} itemsIn={itemsIn} onOpenDay={(d) => show("day", d)} onOpenMonth={(m) => show("month", m)} />
      )}

      <button
        type="button"
        onClick={() => add()}
        className="bar fixed right-5 bottom-7 left-5 z-30 mx-auto flex h-[56px] max-w-[560px] items-center justify-center gap-2 rounded-[18px] bg-clay text-[16px] font-semibold text-on-clay shadow-float safe-bottom lg:hidden"
      >
        <Icon.Plus size={20} /> Add event
      </button>

      {reading ? (
        <EventDetails
          key={`${reading.event.id}:${reading.occurrence}`}
          event={events.find((e) => e.id === reading.event.id) ?? reading.event}
          occurrence={reading.occurrence}
          open
          onOpenChange={(v) => !v && setReading(null)}
          onEdit={() => {
            setEditing({ event: events.find((e) => e.id === reading.event.id) ?? reading.event, occurrence: reading.occurrence });
            setReading(null);
          }}
        />
      ) : null}

      <EventEditor
        key={editing ? (editing.event ? `${editing.event.id}:${editing.occurrence}` : `new:${editing.draft?.date}:${editing.draft?.time}`) : "none"}
        event={editing?.event}
        occurrence={editing?.occurrence}
        draft={editing?.draft}
        open={editing !== null}
        onOpenChange={(v) => !v && setEditing(null)}
      />
    </div>
  );
}
