"use client";

import { usePantry } from "@/components/app/Pantry";
import { useNav } from "@/lib/client/nav";
import { cn } from "@/lib/client/util";

/** Lists | Pantry | Calendar switch for phones (the sidebar does this on desktop). */
export function AppTabs() {
  const { route, go } = useNav();
  const { counts } = usePantry();
  const pantry = route.view === "pantry";
  const calendar = route.view === "calendar";
  const lists = !pantry && !calendar;
  const alert = counts.expired + counts.soon;
  const tab = (on: boolean) =>
    cn("flex h-10 flex-1 items-center justify-center gap-1.5 rounded-[10px] text-[15px] transition-colors", on ? "bg-surface font-semibold shadow-sm" : "text-ink-2");
  return (
    <nav aria-label="Sections" className="mx-5 mt-1 grid grid-cols-3 gap-1 rounded-xl bg-sunken p-1 lg:hidden">
      <button type="button" aria-current={lists ? "page" : undefined} onClick={() => go({})} className={tab(lists)}>
        Lists
      </button>
      <button type="button" aria-current={pantry ? "page" : undefined} onClick={() => go({ view: "pantry" })} className={tab(pantry)}>
        Pantry
        {alert ? (
          <span
            className={cn(
              "min-w-5 rounded-full px-1.5 text-[12px] leading-5 font-semibold tabular-nums",
              counts.expired ? "bg-danger text-white" : "bg-warn-soft text-warn",
            )}
          >
            {alert}
          </span>
        ) : null}
      </button>
      <button type="button" aria-current={calendar ? "page" : undefined} onClick={() => go({ view: "calendar" })} className={tab(calendar)}>
        Calendar
      </button>
    </nav>
  );
}
