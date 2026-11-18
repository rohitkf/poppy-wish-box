"use client";

import { KEEP_DAYS_AFTER } from "@/lib/calendar";
import { cn } from "@/lib/client/util";
import { useShowHolidays } from "@/components/app/calendar/shared";

export function CalendarSettings() {
  const [on, set] = useShowHolidays();
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[15px] font-semibold">Bank holidays</div>
          <p className="text-[13px] text-ink-3">England &amp; Wales, from gov.uk, for every year you look at. This setting is for this device only.</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label="Show bank holidays"
          onClick={() => set(!on)}
          className={cn("relative h-8 w-[52px] shrink-0 rounded-full transition-colors", on ? "bg-teal" : "bg-line-2")}
        >
          <span className={cn("absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-[left]", on ? "left-[24px]" : "left-1")} />
        </button>
      </div>
      <p className="text-[13px] text-ink-3">
        Events are deleted {KEEP_DAYS_AFTER} days after they end, to keep the database small. Repeats are kept until {KEEP_DAYS_AFTER} days after their
        last date, and repeats with no end date are always kept.
      </p>
    </div>
  );
}
