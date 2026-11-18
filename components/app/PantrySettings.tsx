"use client";

import { useState } from "react";
import { Icon } from "@/components/icons";
import { useSpace } from "@/components/app/SpaceProvider";
import { usePantry } from "@/components/app/Pantry";

export function PantrySettings() {
  const { actions } = useSpace();
  const { locations, warnDays, items } = usePantry();
  const [newLoc, setNewLoc] = useState("");

  const addLocation = () => {
    const l = newLoc.trim();
    if (!l || locations.some((x) => x.toLowerCase() === l.toLowerCase())) return setNewLoc("");
    actions.updateSpace({ pantry_locations: [...locations, l] });
    setNewLoc("");
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[15px] font-semibold">Warn me</div>
          <p className="text-[13px] text-ink-3">
            {warnDays === 0 ? "Amber on the day itself, red once it's past." : `Amber when ${warnDays} day${warnDays === 1 ? "" : "s"} or fewer are left, red once it's past.`}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1 rounded-xl bg-sunken p-1">
          <button
            type="button"
            aria-label="Warn one day later"
            disabled={warnDays <= 0}
            onClick={() => actions.updateSpace({ expiry_warn_days: warnDays - 1 })}
            className="h-9 w-9 rounded-[9px] text-[18px] disabled:opacity-40"
          >
            −
          </button>
          <span className="w-16 text-center text-[15px] font-semibold tabular-nums">
            {warnDays} day{warnDays === 1 ? "" : "s"}
          </span>
          <button
            type="button"
            aria-label="Warn one day earlier"
            disabled={warnDays >= 30}
            onClick={() => actions.updateSpace({ expiry_warn_days: warnDays + 1 })}
            className="h-9 w-9 rounded-[9px] text-[18px] disabled:opacity-40"
          >
            +
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="text-[15px] font-semibold">Places</div>
        <ul className="flex flex-wrap gap-2">
          {locations.map((l) => {
            const used = items.filter((i) => i.location === l).length;
            return (
              <li key={l} className="flex h-9 items-center gap-1 rounded-full border border-line-2 pr-1 pl-3.5 text-[14px]">
                {l}
                {used ? <span className="text-ink-3">· {used}</span> : null}
                <button
                  type="button"
                  aria-label={`Remove ${l}`}
                  disabled={locations.length <= 1}
                  onClick={() => actions.updateSpace({ pantry_locations: locations.filter((x) => x !== l) })}
                  className="flex h-7 w-7 items-center justify-center rounded-full text-ink-3 hover:bg-sunken disabled:opacity-30"
                >
                  <Icon.Close size={14} />
                </button>
              </li>
            );
          })}
        </ul>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            addLocation();
          }}
          className="flex gap-2"
        >
          <input
            value={newLoc}
            onChange={(e) => setNewLoc(e.target.value)}
            placeholder="Add a place, e.g. Garage fridge"
            maxLength={40}
            aria-label="New place"
            className="h-11 min-w-0 flex-1 rounded-xl border border-line-2 bg-bg px-3 text-[15px] outline-none focus:border-ink"
          />
          <button type="submit" disabled={!newLoc.trim()} className="h-11 rounded-xl bg-ink px-4 text-[14px] font-semibold text-bg disabled:opacity-40">
            Add
          </button>
        </form>
        <p className="text-[13px] text-ink-3">Removing a place keeps the items in it; they just stop showing it as a choice.</p>
      </div>
    </div>
  );
}
