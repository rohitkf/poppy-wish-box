"use client";

import { useState } from "react";
import { Icon } from "@/components/icons";
import { Segmented } from "@/components/ui/bits";
import { Sheet } from "@/components/ui/sheet";
import { ColorPicker, DatePicker, TimePicker } from "@/components/ui/fields";
import { useSpace } from "@/components/app/SpaceProvider";
import { addDays, daysBetween, EVENT_COLORS, EVENT_KINDS, formatDate, kindOf, minutes, REMINDERS, repeatLabel } from "@/lib/calendar";
import { showToast } from "@/lib/client/toast";
import { cn } from "@/lib/client/util";
import type { CalendarEvent, Repeat } from "@/lib/types";

export interface Draft {
  date: string;
  time?: string;
}

const pad = (n: number) => String(n).padStart(2, "0");
const addMinutes = (t: string, n: number) => {
  const m = Math.min(23 * 60 + 59, Math.max(0, minutes(t) + n));
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
};

/** Add or edit an event. `occurrence` is the date tapped, for "delete just this one". */
export function EventEditor({
  event,
  occurrence,
  draft,
  open,
  onOpenChange,
}: {
  event?: CalendarEvent;
  occurrence?: string;
  draft?: Draft;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { actions, data } = useSpace();
  const members = data.space.member_names ?? [];
  const startKind = event ? kindOf(event.kind) : draft?.time ? kindOf("appointment") : kindOf("other");
  const [title, setTitle] = useState(event?.title ?? "");
  const [kind, setKind] = useState(startKind.key);
  const [color, setColor] = useState(event?.color ?? startKind.color);
  const [colorChosen, setColorChosen] = useState(!!event);
  const [allDay, setAllDay] = useState(event ? !event.start_time : !draft?.time);
  const [startDate, setStartDate] = useState(event?.start_date ?? draft?.date ?? "");
  const [endDate, setEndDate] = useState(event?.end_date ?? draft?.date ?? "");
  const [startTime, setStartTime] = useState(event?.start_time ?? draft?.time ?? "09:00");
  const [endTime, setEndTime] = useState(event?.end_time ?? (draft?.time ? addMinutes(draft.time, 60) : "10:00"));
  const [who, setWho] = useState<string[]>(event?.who ?? []);
  const [repeat, setRepeat] = useState<Repeat>(event?.repeat ?? "none");
  const [until, setUntil] = useState(event?.repeat_until ?? "");
  const [remind, setRemind] = useState<number | null>(event?.remind_days ?? null);
  const [location, setLocation] = useState(event?.location ?? "");
  const [notes, setNotes] = useState(event?.notes ?? "");

  const pickKind = (key: string) => {
    const k = kindOf(key);
    setKind(key);
    if (!colorChosen) setColor(k.color);
    if (!event) {
      setAllDay(k.allDay);
      if (k.repeat) setRepeat(k.repeat);
      else if (repeat === "yearly" && kindOf(kind).repeat) setRepeat("none");
    }
  };

  // Moving the start keeps the length; the end can't go before the start.
  const moveStartDate = (v: string) => {
    if (!v) return;
    const span = startDate && endDate ? Math.max(0, daysBetween(startDate, endDate)) : 0;
    setStartDate(v);
    setEndDate(addDays(v, span));
  };
  const moveStartTime = (v: string) => {
    if (!v) return;
    const len = startTime && endTime && startDate === endDate ? minutes(endTime) - minutes(startTime) : 60;
    setStartTime(v);
    if (startDate === endDate) setEndTime(addMinutes(v, Math.max(15, len)));
  };

  const days = startDate && endDate ? daysBetween(startDate, endDate) + 1 : 1;
  const timeBackwards = !allDay && startDate === endDate && endTime < startTime;
  const invalid = !title.trim() || !startDate || !endDate || endDate < startDate || timeBackwards || (repeat !== "none" && !!until && until < startDate);

  const save = () => {
    if (invalid) return;
    const fields = {
      title: title.trim(),
      kind,
      color,
      start_date: startDate,
      end_date: endDate,
      start_time: allDay ? null : startTime,
      end_time: allDay ? null : endTime || null,
      who: members.length && who.length === members.length ? [] : who,
      location: location.trim() || null,
      notes: notes.trim() || null,
      repeat,
      repeat_until: repeat === "none" ? null : until || null,
      remind_days: remind,
    };
    if (event) actions.updateEvent(event.id, fields);
    else actions.addEvent(fields);
    onOpenChange(false);
  };

  const skipOne = () => {
    if (!event || !occurrence) return;
    const before = event.skip_dates ?? [];
    actions.updateEvent(event.id, { skip_dates: [...before, occurrence] });
    showToast({
      message: `Removed ${formatDate(occurrence, "dayMonthYear")} only`,
      action: { label: "Undo", onClick: () => actions.updateEvent(event.id, { skip_dates: before }) },
    });
    onOpenChange(false);
  };

  const label = "text-[14px] font-semibold";
  const field = "h-11 min-w-0 rounded-xl border border-line-2 bg-surface px-3 text-[16px] outline-none focus:border-ink";
  const chip = (on: boolean) => cn("h-9 rounded-full px-3.5 text-[14px]", on ? "bg-teal font-semibold text-white" : "border border-line-2 text-ink-2");
  const repeating = !!event && event.repeat !== "none";

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={event ? "Edit event" : "New event"}
      description={repeating ? "Changes apply to every repeat." : undefined}
      wide
      footer={
        <div className="flex flex-col gap-2">
          <button
            type="button"
            disabled={invalid}
            onClick={save}
            className="h-[50px] rounded-[14px] bg-clay text-[16px] font-semibold text-on-clay disabled:opacity-50"
          >
            {event ? "Save" : "Add to calendar"}
          </button>
          {event ? (
            <div className="flex gap-2">
              {repeating && occurrence ? (
                <button type="button" onClick={skipOne} className="h-11 flex-1 rounded-[14px] text-[15px] font-medium text-danger">
                  Delete this one
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  actions.removeEvent(event.id);
                  onOpenChange(false);
                }}
                className="h-11 flex-1 rounded-[14px] text-[15px] font-medium text-danger"
              >
                {repeating ? "Delete all repeats" : "Delete event"}
              </button>
            </div>
          ) : null}
        </div>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
        className="flex flex-col gap-5 pt-2"
      >
        <label className="flex flex-col gap-1.5">
          <span className={label}>What&apos;s happening?</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Driving test, Lisbon trip, Day off"
            maxLength={160}
            autoFocus={!event}
            enterKeyHint="done"
            className={field}
          />
        </label>

        <fieldset className="flex flex-col gap-1.5">
          <legend className={cn(label, "mb-1.5")}>Type</legend>
          <div className="flex flex-wrap gap-2">
            {EVENT_KINDS.map((k) => (
              <button key={k.key} type="button" aria-pressed={kind === k.key} onClick={() => pickKind(k.key)} className={cn(chip(kind === k.key), "flex items-center gap-1.5")}>
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: k.color }} aria-hidden />
                {k.label}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-1.5">
          <legend className={cn(label, "mb-1.5")}>Colour</legend>
          <div className="flex flex-wrap items-center gap-2">
            {EVENT_COLORS.map((c) => (
              <button
                key={c.hex}
                type="button"
                aria-label={c.name}
                aria-pressed={color === c.hex}
                onClick={() => {
                  setColor(c.hex);
                  setColorChosen(true);
                }}
                className={cn("flex h-9 w-9 items-center justify-center rounded-full text-white", color === c.hex && "ring-2 ring-ink ring-offset-2 ring-offset-bg")}
                style={{ background: c.hex }}
              >
                {color === c.hex ? <Icon.Check size={16} /> : null}
              </button>
            ))}
            <ColorPicker
              value={color}
              presets={EVENT_COLORS.map((c) => c.hex)}
              onChange={(c) => {
                setColor(c);
                setColorChosen(true);
              }}
            />
          </div>
        </fieldset>

        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <span className={label}>When</span>
            <label className="flex items-center gap-2 text-[14px] text-ink-2">
              All day
              <button
                type="button"
                role="switch"
                aria-checked={allDay}
                onClick={() => setAllDay(!allDay)}
                className={cn("relative h-7 w-12 rounded-full transition-colors", allDay ? "bg-teal" : "bg-line-2")}
              >
                <span className={cn("absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-[left]", allDay ? "left-[22px]" : "left-0.5")} />
              </button>
            </label>
          </div>
          <div className="grid grid-cols-[3.5rem_minmax(0,1fr)_auto] items-center gap-2">
            <span className="text-[14px] text-ink-3">Starts</span>
            <DatePicker label="Start date" value={startDate || null} onChange={(v) => v && moveStartDate(v)} format="dayMonthYear" />
            {!allDay ? <TimePicker label="Start time" value={startTime} onChange={moveStartTime} className="w-[6.5rem]" /> : <span />}
            <span className="text-[14px] text-ink-3">Ends</span>
            <DatePicker label="End date" value={endDate || null} min={startDate || undefined} onChange={(v) => v && setEndDate(v)} format="dayMonthYear" />
            {!allDay ? <TimePicker label="End time" value={endTime} onChange={setEndTime} className="w-[6.5rem]" /> : <span />}
          </div>
          {endDate < startDate || timeBackwards ? (
            <p className="text-[13px] font-medium text-danger">The end is before the start.</p>
          ) : allDay && days > 1 ? (
            <p className="text-[13px] text-ink-3">{days} days</p>
          ) : null}
        </div>

        {members.length ? (
          <fieldset className="flex flex-col gap-1.5">
            <legend className={cn(label, "mb-1.5")}>Who&apos;s it for?</legend>
            <div className="flex flex-wrap gap-2">
              <button type="button" aria-pressed={!who.length} onClick={() => setWho([])} className={chip(!who.length || who.length === members.length)}>
                {members.length === 2 ? "Both" : "Everyone"}
              </button>
              {members.map((m) => {
                const on = who.includes(m) && who.length < members.length;
                return (
                  <button
                    key={m}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setWho(on ? who.filter((x) => x !== m) : who.length === members.length ? [m] : [...who, m])}
                    className={chip(on)}
                  >
                    {m}
                  </button>
                );
              })}
            </div>
          </fieldset>
        ) : null}

        <div className="flex flex-col gap-2">
          <span className={label}>Repeat</span>
          <Segmented
            label="Repeat"
            size="sm"
            value={repeat}
            onChange={(v) => setRepeat(v ?? "none")}
            options={[
              { value: "none", label: "Once" },
              { value: "weekly", label: "Weekly" },
              { value: "monthly", label: "Monthly" },
              { value: "yearly", label: "Yearly" },
            ]}
          />
          {repeat !== "none" && startDate ? (
            <div className="flex flex-col gap-1.5">
              <p className="text-[13px] text-ink-3">{repeatLabel({ repeat, repeat_until: until || null, start_date: startDate })}</p>
              <div className="flex items-center gap-2">
                <span className="text-[14px] text-ink-3">Until</span>
                <DatePicker label="Repeat until" value={until || null} min={startDate || undefined} onChange={(v) => setUntil(v ?? "")} placeholder="No end date" className="flex-1" />
                {until ? (
                  <button type="button" onClick={() => setUntil("")} className="h-11 px-2 text-[14px] text-ink-3">
                    For ever
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex flex-col gap-2">
          <span className={cn(label, "flex items-center gap-1.5")}>
            <Icon.Bell size={16} /> Remind us
          </span>
          <Segmented
            label="Remind us"
            size="sm"
            value={remind === null ? -1 : remind}
            onChange={(v) => setRemind(v === null || v === -1 ? null : v)}
            options={[{ value: -1, label: "Off" }, ...REMINDERS.map((r) => ({ value: r.days, label: r.label }))]}
          />
          {remind !== null ? (
            <p className="text-[13px] text-ink-3">
              A notification around 7am {REMINDERS.find((r) => r.days === remind)?.note ?? `${remind} days before`}, on phones with reminders turned on in
              Settings.
            </p>
          ) : null}
        </div>

        <label className="flex flex-col gap-1.5">
          <span className={label}>Where</span>
          <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Optional" maxLength={300} className={field} />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className={label}>Notes</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Flight numbers, booking refs, what to bring…"
            maxLength={5000}
            rows={3}
            className="min-h-[88px] rounded-xl border border-line-2 bg-surface px-3 py-2.5 text-[16px] outline-none focus:border-ink"
          />
        </label>
        <button type="submit" className="sr-only">
          Save
        </button>
      </form>
    </Sheet>
  );
}
