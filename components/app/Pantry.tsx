"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useMemo, useRef, useState } from "react";
import { Icon } from "@/components/icons";
import { HereIndicator, Logo } from "@/components/ui/bits";
import { Sheet } from "@/components/ui/sheet";
import { cleanNumber, DatePicker, Select } from "@/components/ui/fields";
import { useSpace } from "@/components/app/SpaceProvider";
import { AppTabs } from "@/components/app/AppTabs";
import { useNow } from "@/lib/client/clock";
import { useNav } from "@/lib/client/nav";
import {
  addDays,
  addMonths,
  expiryBadge,
  expiryLabel,
  freshness,
  MEASURES,
  openedLabel,
  PANTRY_CATEGORIES,
  PANTRY_UNITS,
  pantryCounts,
  quantityLabel,
  sortPantry,
  todayISO,
  type Freshness,
} from "@/lib/client/pantry";
import { cn } from "@/lib/client/util";
import type { PantryItem } from "@/lib/types";

const DEFAULT_LOCATIONS = ["Fridge", "Freezer", "Pantry"];

/** Pantry data with safe defaults (an older cached copy may predate the pantry). */
export function usePantry() {
  const { data } = useSpace();
  const now = useNow();
  const today = todayISO(now ? new Date(now) : new Date());
  const items = useMemo(() => data.pantry ?? [], [data.pantry]);
  const locations = data.space.pantry_locations?.length ? data.space.pantry_locations : DEFAULT_LOCATIONS;
  const warnDays = data.space.expiry_warn_days ?? 3;
  const counts = useMemo(() => pantryCounts(items, today, warnDays), [items, today, warnDays]);
  return { items, locations, warnDays, today, counts };
}

const SECTION: Record<Freshness, { title: string; hint?: string }> = {
  expired: { title: "Expired", hint: "Check these first" },
  soon: { title: "Use soon" },
  fresh: { title: "Fresh" },
  undated: { title: "No date" },
};

const BADGE: Record<Freshness, string> = {
  expired: "bg-danger text-white",
  soon: "bg-warn-soft text-warn ring-1 ring-warn-line",
  fresh: "bg-teal-soft text-teal-ink",
  undated: "bg-sunken text-ink-3",
};

function PantryRow({ item, onOpen }: { item: PantryItem; onOpen: () => void }) {
  const { actions } = useSpace();
  const { today, warnDays } = usePantry();
  const f = freshness(item, today, warnDays);
  const meta = [item.location, quantityLabel(item), item.category, openedLabel(item, today)].filter(Boolean);
  const many = item.quantity !== null && item.quantity > 1 && !MEASURES.includes(item.unit ?? "");
  return (
    <motion.li layout="position" initial={false} className="flex items-center gap-3 rounded-[14px] px-2 py-2.5">
      <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <span
          className={cn(
            "flex h-11 w-14 shrink-0 flex-col items-center justify-center rounded-xl text-[13px] leading-tight font-semibold tabular-nums",
            BADGE[f],
          )}
          aria-hidden
        >
          {expiryBadge(item, today)}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate text-[16px] font-semibold">{item.name}</span>
          <span
            className={cn(
              "truncate text-[13px]",
              f === "expired" ? "font-medium text-danger" : f === "soon" ? "font-medium text-warn" : "text-ink-3",
            )}
          >
            {expiryLabel(item, today)}
            <span className="text-ink-3"> · {meta.join(" · ")}</span>
          </span>
        </span>
      </button>
      <button
        type="button"
        onClick={() =>
          many ? actions.updatePantry(item.id, { quantity: Number((item.quantity! - 1).toFixed(2)) }) : actions.removePantry(item.id, "Used up")
        }
        aria-label={many ? `Used one ${item.name}` : `${item.name} used up`}
        className="flex h-10 shrink-0 items-center gap-1 rounded-[10px] border border-line-2 px-2.5 text-[13px] font-medium text-ink-2 hover:bg-sunken"
      >
        {many ? (
          "−1"
        ) : (
          <>
            <Icon.Check size={15} /> Used
          </>
        )}
      </button>
    </motion.li>
  );
}

function Chip({ on, onClick, tone, children }: { on: boolean; onClick: () => void; tone?: "warn" | "danger"; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        "h-9 shrink-0 rounded-full px-3.5 text-[14px] whitespace-nowrap transition-colors",
        on
          ? "bg-ink font-medium text-bg"
          : tone === "danger"
            ? "border border-danger-line text-danger"
            : tone === "warn"
              ? "border border-warn-line text-warn"
              : "border border-line-2 text-ink hover:bg-sunken",
      )}
    >
      {children}
    </button>
  );
}

/** Red/amber summary, shown on the Pantry tab and on the lists home. */
export function PantryAlert({ onOpen, compact }: { onOpen?: () => void; compact?: boolean }) {
  const { counts } = usePantry();
  if (!counts.expired && !counts.soon) return null;
  const danger = counts.expired > 0;
  const parts = [
    counts.expired ? `${counts.expired} expired` : null,
    counts.soon ? `${counts.soon} to use soon` : null,
  ].filter(Boolean);
  const Tag = onOpen ? "button" : "div";
  return (
    <Tag
      {...(onOpen ? { type: "button" as const, onClick: onOpen } : {})}
      className={cn(
        "flex w-full items-center gap-3 rounded-2xl border px-4 text-left",
        compact ? "py-2.5" : "py-3.5",
        danger ? "border-danger-line bg-danger-soft text-danger" : "border-warn-line bg-warn-soft text-warn",
      )}
    >
      <Icon.Alert size={20} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-[15px] font-semibold">Pantry: {parts.join(", ")}</span>
        {!compact ? (
          <span className="text-[13px] opacity-90">{danger ? "Check whether they're still OK, or bin them." : "Plan them into the next few meals."}</span>
        ) : null}
      </span>
      {onOpen ? <Icon.ChevronRight size={18} /> : null}
    </Tag>
  );
}

export function Pantry() {
  const { here } = useSpace();
  const { go } = useNav();
  const { items, locations, warnDays, today, counts } = usePantry();
  const [filter, setFilter] = useState<string>("all");
  const [editing, setEditing] = useState<PantryItem | "new" | null>(null);

  const shown = useMemo(() => {
    const byFilter = items.filter((i) => {
      if (filter === "all") return true;
      if (filter === "attention") return ["expired", "soon"].includes(freshness(i, today, warnDays));
      return i.location === filter;
    });
    return sortPantry(byFilter, today, warnDays);
  }, [items, filter, today, warnDays]);
  const groups = (["expired", "soon", "fresh", "undated"] as Freshness[])
    .map((f) => ({ f, items: shown.filter((i) => freshness(i, today, warnDays) === f) }))
    .filter((g) => g.items.length);
  // Locations used by items but since removed from the list still get a chip.
  const allLocations = [...new Set([...locations, ...items.map((i) => i.location)])];

  return (
    <div className="flex min-h-full flex-col pb-32 lg:mx-auto lg:w-full lg:max-w-[760px] lg:px-10 lg:pb-12">
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

      <div className="flex flex-col gap-4 px-5 pt-3 lg:px-0 lg:pt-10">
        <div className="flex items-center justify-between gap-3">
          <h1 className="font-display text-[36px] font-semibold tracking-[-0.5px] lg:text-[38px]">Pantry</h1>
          <button
            type="button"
            onClick={() => setEditing("new")}
            className="hidden h-10 items-center gap-1.5 rounded-[10px] bg-clay px-4 text-[14px] font-semibold text-on-clay lg:flex"
          >
            <Icon.Plus size={18} /> Add food
          </button>
        </div>
        <PantryAlert onOpen={counts.expired || counts.soon ? () => setFilter("attention") : undefined} />
      </div>

      <div className="no-scrollbar flex gap-2 overflow-x-auto px-5 pt-4 lg:px-0">
        <Chip on={filter === "all"} onClick={() => setFilter("all")}>
          All {items.length}
        </Chip>
        {counts.expired + counts.soon ? (
          <Chip on={filter === "attention"} tone={counts.expired ? "danger" : "warn"} onClick={() => setFilter(filter === "attention" ? "all" : "attention")}>
            Needs attention {counts.expired + counts.soon}
          </Chip>
        ) : null}
        {allLocations.map((l) => (
          <Chip key={l} on={filter === l} onClick={() => setFilter(filter === l ? "all" : l)}>
            {l} {items.filter((i) => i.location === l).length}
          </Chip>
        ))}
      </div>

      {items.length === 0 ? (
        <div className="mx-5 mt-6 flex flex-col items-center gap-3 rounded-2xl border-[1.5px] border-dashed border-dash px-6 py-10 text-center lg:mx-0">
          <Icon.Jar size={28} />
          <p className="max-w-[300px] text-[15px] text-ink-2">
            Add what&apos;s in the fridge, freezer and cupboards with its expiry date. Things close to their date show up here first, in amber, then red.
          </p>
          <button type="button" onClick={() => setEditing("new")} className="text-[14px] font-semibold text-clay-ink">
            Add the first item
          </button>
        </div>
      ) : shown.length === 0 ? (
        <p className="px-5 py-10 text-center text-[15px] text-ink-3">Nothing here.</p>
      ) : (
        <div className="flex flex-col gap-4 pt-4">
          {groups.map((g) => (
            <section key={g.f} aria-label={SECTION[g.f].title} className="px-3 lg:px-0">
              <h2
                className={cn(
                  "px-2 pb-1 text-[13px] font-semibold tracking-[0.6px] uppercase",
                  g.f === "expired" ? "text-danger" : g.f === "soon" ? "text-warn" : "text-ink-3",
                )}
              >
                {SECTION[g.f].title} · {g.items.length}
              </h2>
              <ul className="flex flex-col gap-0.5">
                <AnimatePresence initial={false}>
                  {g.items.map((i) => (
                    <PantryRow key={i.id} item={i} onOpen={() => setEditing(i)} />
                  ))}
                </AnimatePresence>
              </ul>
            </section>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => setEditing("new")}
        className="bar fixed right-5 bottom-7 left-5 z-30 mx-auto flex h-[56px] max-w-[560px] items-center justify-center gap-2 rounded-[18px] bg-clay text-[16px] font-semibold text-on-clay shadow-float safe-bottom lg:hidden"
      >
        <Icon.Plus size={20} /> Add food
      </button>

      <PantryEditor
        key={editing === "new" ? "new" : (editing?.id ?? "none")}
        item={editing === "new" ? undefined : (editing ?? undefined)}
        open={editing !== null}
        defaultLocation={filter !== "all" && filter !== "attention" ? filter : undefined}
        onOpenChange={(v) => !v && setEditing(null)}
      />
    </div>
  );
}

function PantryEditor({
  item,
  open,
  onOpenChange,
  defaultLocation,
}: {
  item?: PantryItem;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultLocation?: string;
}) {
  const { actions } = useSpace();
  const { locations, today } = usePantry();
  const [name, setName] = useState(item?.name ?? "");
  const [location, setLocation] = useState(item?.location ?? defaultLocation ?? locations[0]);
  const [category, setCategory] = useState(item?.category ?? "");
  const [quantity, setQuantity] = useState(item?.quantity != null ? String(item.quantity) : "");
  const [unit, setUnit] = useState(item?.unit ?? "");
  const [expires, setExpires] = useState(item?.expires_on ?? "");
  const [opened, setOpened] = useState(item?.opened_on ?? "");
  const nameRef = useRef<HTMLInputElement>(null);
  const allLocations = [...new Set([...locations, ...(item ? [item.location] : [])])];

  const values = () => ({
    name: name.trim(),
    location,
    category: category || null,
    quantity: quantity.trim() === "" ? null : Math.max(0, Number(quantity)),
    unit: unit || null,
    expires_on: expires || null,
    opened_on: opened || null,
  });

  const save = (again: boolean) => {
    const v = values();
    if (!v.name || (v.quantity !== null && !Number.isFinite(v.quantity))) return;
    if (item) actions.updatePantry(item.id, v);
    else actions.addPantry(v);
    if (again) {
      setName("");
      setQuantity("");
      setUnit("");
      setExpires("");
      setOpened("");
      nameRef.current?.focus();
    } else onOpenChange(false);
  };

  const quick = [
    { label: "+3 days", value: addDays(today, 3) },
    { label: "+1 week", value: addDays(today, 7) },
    { label: "+2 weeks", value: addDays(today, 14) },
    { label: "+1 month", value: addMonths(today, 1) },
    { label: "+6 months", value: addMonths(today, 6) },
  ];
  const label = "text-[14px] font-semibold";
  const field = "h-11 min-w-0 rounded-xl border border-line-2 bg-surface px-3 text-[16px] outline-none focus:border-ink";

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={item ? "Edit item" : "Add food"}
      footer={
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <button
              type="button"
              disabled={!name.trim()}
              onClick={() => save(false)}
              className="h-[50px] flex-1 rounded-[14px] bg-clay text-[16px] font-semibold text-on-clay disabled:opacity-50"
            >
              {item ? "Save" : "Add"}
            </button>
            {!item ? (
              <button
                type="button"
                disabled={!name.trim()}
                onClick={() => save(true)}
                className="h-[50px] flex-1 rounded-[14px] border border-line-2 text-[15px] font-medium disabled:opacity-50"
              >
                Add & another
              </button>
            ) : null}
          </div>
          {item ? (
            <button
              type="button"
              onClick={() => {
                actions.removePantry(item.id);
                onOpenChange(false);
              }}
              className="h-11 rounded-[14px] text-[15px] font-medium text-danger"
            >
              Remove from pantry
            </button>
          ) : null}
        </div>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save(false);
        }}
        className="flex flex-col gap-4 pt-2"
      >
        <label className="flex flex-col gap-1.5">
          <span className={label}>What is it?</span>
          <input
            ref={nameRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Greek yoghurt"
            maxLength={120}
            autoFocus={!item}
            enterKeyHint="done"
            className={field}
          />
        </label>

        <fieldset className="flex flex-col gap-1.5">
          <legend className={cn(label, "mb-1.5")}>Where is it?</legend>
          <div className="flex flex-wrap gap-2">
            {allLocations.map((l) => (
              <button
                key={l}
                type="button"
                aria-pressed={location === l}
                onClick={() => setLocation(l)}
                className={cn(
                  "h-10 rounded-full px-4 text-[14px]",
                  location === l ? "bg-teal font-semibold text-white" : "border border-line-2 text-ink-2",
                )}
              >
                {l}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="flex flex-col gap-1.5">
          <span className={label}>Best before / use by</span>
          <div className="flex items-center gap-2">
            <DatePicker label="Best before" value={expires || null} onChange={(v) => setExpires(v ?? "")} placeholder="No date" clearable className="flex-1" />
            {expires ? (
              <button type="button" onClick={() => setExpires("")} className="h-11 px-2 text-[14px] text-ink-3">
                Clear
              </button>
            ) : null}
          </div>
          <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 pt-1">
            {quick.map((q) => (
              <button
                key={q.label}
                type="button"
                onClick={() => setExpires(q.value)}
                className={cn(
                  "h-8 shrink-0 rounded-full px-3 text-[13px]",
                  expires === q.value ? "bg-ink font-medium text-bg" : "bg-sunken text-ink-2",
                )}
              >
                {q.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className={label}>Quantity</span>
            <input
              type="text"
              inputMode="decimal"
              value={quantity}
              onChange={(e) => setQuantity(cleanNumber(e.target.value))}
              placeholder="e.g. 2"
              className={field}
            />
          </label>
          <div className="flex flex-col gap-1.5">
            <span className={label}>Unit</span>
            <Select
              label="Unit"
              value={unit}
              onChange={setUnit}
              options={[...new Set([...PANTRY_UNITS, unit])].map((u) => ({ value: u, label: u || "items" }))}
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className={label}>Category</span>
          <Select
            label="Category"
            value={category}
            onChange={setCategory}
            options={[{ value: "", label: "None" }, ...[...new Set([...PANTRY_CATEGORIES, ...(category ? [category] : [])])].map((c) => ({ value: c, label: c }))]}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <span className={label}>Opened</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-pressed={!opened}
              onClick={() => setOpened("")}
              className={cn("h-11 rounded-xl px-3.5 text-[14px]", !opened ? "bg-teal font-semibold text-white" : "border border-line-2 text-ink-2")}
            >
              Not opened
            </button>
            <button
              type="button"
              aria-pressed={opened === today}
              onClick={() => setOpened(today)}
              className={cn(
                "h-11 rounded-xl px-3.5 text-[14px]",
                opened === today ? "bg-teal font-semibold text-white" : "border border-line-2 text-ink-2",
              )}
            >
              Today
            </button>
            <DatePicker
              label="Opened on"
              value={opened && opened !== today ? opened : null}
              max={today}
              onChange={(v) => setOpened(v ?? "")}
              placeholder="Another day"
              format="dayMonthYear"
              className="flex-1"
            />
          </div>
        </div>
        <button type="submit" className="sr-only">
          Save
        </button>
      </form>
    </Sheet>
  );
}
