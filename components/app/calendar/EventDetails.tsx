"use client";

import { Icon } from "@/components/icons";
import { Sheet } from "@/components/ui/sheet";
import { useSpace } from "@/components/app/SpaceProvider";
import { WhoDots, formatRange, reminderLabel } from "@/components/app/calendar/shared";
import { addDays, daysBetween, formatDate, kindOf, repeatLabel } from "@/lib/calendar";
import { relativeTime } from "@/lib/format";
import { showToast } from "@/lib/client/toast";
import type { CalendarEvent } from "@/lib/types";

/**
 * What an event is, read before it's edited (as the church diary does): tapping something on
 * a calendar is nearly always to read it, and a form invites accidental changes.
 */
/** "just now", "5m ago", "yesterday", "Tue", "3 Oct". */
const ago = (iso: string) => {
  const r = relativeTime(iso);
  return /^\d+[mh]$/.test(r) ? `${r} ago` : r;
};

export function EventDetails({
  event,
  occurrence,
  open,
  onOpenChange,
  onEdit,
}: {
  event: CalendarEvent;
  /** The date of the repeat that was tapped. */
  occurrence: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onEdit: () => void;
}) {
  const { actions, data } = useSpace();
  const span = daysBetween(event.start_date, event.end_date);
  const start = event.repeat === "none" ? event.start_date : occurrence;
  const end = event.repeat === "none" ? event.end_date : addDays(occurrence, span);
  const repeating = event.repeat !== "none";
  const days = span + 1;
  const date =
    days === 1 ? formatDate(start, "long") : `${formatRange(start, end)}${start.slice(0, 4) === end.slice(0, 4) ? ` ${end.slice(0, 4)}` : ""} · ${days} days`;
  const time = event.start_time ? (event.end_time ? `${event.start_time}–${event.end_time}` : `From ${event.start_time}`) : "All day";
  const members = data.space.member_names ?? [];
  const forWhom = event.who.length ? event.who.join(" & ") : members.length === 2 ? "Both of you" : "Everyone";

  const row = "flex items-start gap-3 text-[15px]";
  const icon = "mt-0.5 shrink-0 text-ink-3";

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={event.title}
      footer={
        <div className="flex flex-col gap-2">
          <button type="button" onClick={onEdit} className="h-[50px] rounded-[14px] bg-ink text-[16px] font-semibold text-bg">
            Edit
          </button>
          <div className="flex gap-2">
            {repeating ? (
              <button
                type="button"
                onClick={() => {
                  const before = event.skip_dates ?? [];
                  actions.updateEvent(event.id, { skip_dates: [...before, occurrence] });
                  showToast({
                    message: `Removed ${formatDate(occurrence, "dayMonthYear")} only`,
                    action: { label: "Undo", onClick: () => actions.updateEvent(event.id, { skip_dates: before }) },
                  });
                  onOpenChange(false);
                }}
                className="h-11 flex-1 rounded-[14px] text-[15px] font-medium text-danger"
              >
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
              {repeating ? "Delete all repeats" : "Delete"}
            </button>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-4 pt-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="h-3 w-3 rounded-full" style={{ background: event.color }} aria-hidden />
          <span className="text-[13px] font-semibold tracking-[0.4px] text-ink-2 uppercase">{kindOf(event.kind).label}</span>
        </div>
        <div className={row}>
          <Icon.Calendar size={18} className={icon} />
          <div className="flex flex-col">
            <span className="font-semibold">{date}</span>
            <span className="text-ink-2 tabular-nums">{time}</span>
          </div>
        </div>
        {repeating ? (
          <div className={row}>
            <Icon.Repeat size={18} className={icon} />
            <span>{repeatLabel(event)}</span>
          </div>
        ) : null}
        <div className={row}>
          <Icon.Users size={18} className={icon} />
          <span className="flex items-center gap-2">
            {forWhom}
            <WhoDots who={event.who} size={22} />
          </span>
        </div>
        {event.location ? (
          <div className={row}>
            <Icon.Location size={18} className={icon} />
            <span className="break-words">{event.location}</span>
          </div>
        ) : null}
        {event.remind_days !== null ? (
          <div className={row}>
            <Icon.Bell size={18} className={icon} />
            <span>{reminderLabel(event.remind_days)}, around 7am</span>
          </div>
        ) : null}
        {event.notes ? <p className="rounded-xl bg-sunken px-3.5 py-3 text-[15px] whitespace-pre-line break-words">{event.notes}</p> : null}
        <p className="text-[13px] text-ink-3">
          {event.added_by ? `Added by ${event.added_by}` : "Added"} · {ago(event.created_at)}
          {event.updated_by && event.updated_at !== event.created_at ? ` · changed by ${event.updated_by}, ${ago(event.updated_at)}` : ""}
        </p>
      </div>
    </Sheet>
  );
}

