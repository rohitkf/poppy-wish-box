"use client";

// The app's own form controls. Nothing here hands off to the browser's or the phone's built-in
// pickers (date, time, colour, dropdown, checkbox, number spinners): each is drawn with the app's
// design system, so they look and behave the same on every device and in light and dark.

import * as Popover from "@radix-ui/react-popover";
import { useState } from "react";
import { Icon } from "@/components/icons";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@/components/ui/menu";
import { addDays, addMonths, daysBetween, endOfMonth, formatDate, startOfMonth, startOfWeek, todayLocal, weekday } from "@/lib/calendar";
import { cn } from "@/lib/client/util";

/** The bordered box every field shares (inputs use the same classes). */
export const FIELD = "h-11 min-w-0 rounded-xl border border-line-2 bg-surface px-3 text-[16px] outline-none focus:border-ink";

/** Trigger looks: a bordered field, or plain right-aligned text for the item detail rows. */
type Look = "field" | "inline";
const triggerCls = (look: Look, open: boolean) =>
  look === "field"
    ? cn(FIELD, "flex items-center justify-between gap-2 text-left", open && "border-ink")
    : cn("flex min-w-0 items-center justify-end gap-1.5 rounded-md px-1 py-1 text-right text-[15px] font-medium outline-none hover:bg-sunken focus-visible:bg-sunken", open && "bg-sunken");

function PopoverPanel({ children, align = "start", className }: { children: React.ReactNode; align?: "start" | "end" | "center"; className?: string }) {
  return (
    <Popover.Portal>
      <Popover.Content
        align={align}
        sideOffset={6}
        collisionPadding={12}
        onOpenAutoFocus={(e) => e.preventDefault()}
        className={cn(
          "z-[60] rounded-2xl border border-line bg-surface p-3 text-ink shadow-float outline-none data-[state=open]:animate-[fade_120ms_ease-out]",
          className,
        )}
      >
        {children}
      </Popover.Content>
    </Popover.Portal>
  );
}

// ─── Select ──────────────────────────────────────────────────────────────────

export function Select<T extends string>({
  value,
  options,
  onChange,
  label,
  placeholder = "Choose…",
  look = "field",
  className,
  align = "start",
}: {
  value: T | null;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  /** Accessible name. */
  label: string;
  placeholder?: string;
  look?: Look;
  className?: string;
  align?: "start" | "end";
}) {
  const current = options.find((o) => o.value === value);
  return (
    <Menu modal={false}>
      <MenuTrigger asChild>
        <button type="button" aria-label={`${label}: ${current?.label ?? "not set"}`} className={cn(triggerCls(look, false), "data-[state=open]:border-ink", className)}>
          <span className={cn("truncate", !current && "text-ink-3")}>{current?.label ?? placeholder}</span>
          <Icon.Chevron size={16} className="shrink-0 text-ink-3" />
        </button>
      </MenuTrigger>
      <MenuContent align={align}>
        {options.map((o) => (
          <MenuItem key={o.value} checked={o.value === value} onSelect={() => onChange(o.value)}>
            {o.label}
          </MenuItem>
        ))}
      </MenuContent>
    </Menu>
  );
}

// ─── Date ────────────────────────────────────────────────────────────────────

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

/** A month grid to pick a day from, with a year jump for dates far away. */
export function MonthPicker({ value, onPick, min, max }: { value: string | null; onPick: (d: string) => void; min?: string; max?: string }) {
  const today = todayLocal();
  const [month, setMonth] = useState(startOfMonth(value || today));
  const [years, setYears] = useState<number | null>(null); // first year shown in the year grid
  const gridStart = startOfWeek(month);
  const cells = Math.ceil((daysBetween(gridStart, endOfMonth(month)) + 1) / 7) * 7;
  const y = Number(month.slice(0, 4));
  const nav = "flex h-9 w-9 items-center justify-center rounded-full hover:bg-sunken disabled:opacity-30";

  if (years !== null) {
    return (
      <div className="w-[284px]">
        <div className="mb-2 flex items-center justify-between">
          <button type="button" onClick={() => setYears(years - 20)} aria-label="Earlier years" className={nav}>
            <Icon.Back size={16} />
          </button>
          <span className="font-display text-[17px] font-semibold tabular-nums">
            {years}–{years + 19}
          </span>
          <button type="button" onClick={() => setYears(years + 20)} aria-label="Later years" className={nav}>
            <Icon.ChevronRight size={16} />
          </button>
        </div>
        <div className="grid grid-cols-4 gap-1">
          {Array.from({ length: 20 }, (_, i) => years + i).map((yr) => (
            <button
              key={yr}
              type="button"
              onClick={() => {
                setMonth(`${yr}-${month.slice(5, 7)}-01`);
                setYears(null);
              }}
              className={cn(
                "h-10 rounded-lg text-[14px] tabular-nums",
                yr === y ? "bg-teal font-semibold text-white" : yr === Number(today.slice(0, 4)) ? "font-semibold text-clay-ink" : "hover:bg-sunken",
              )}
            >
              {yr}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="w-[284px]">
      <div className="mb-1 flex items-center justify-between">
        <button type="button" onClick={() => setMonth(addMonths(month, -1))} aria-label="Previous month" className={nav}>
          <Icon.Back size={16} />
        </button>
        <button
          type="button"
          onClick={() => setYears(y - (y % 20))}
          className="flex items-center gap-1 rounded-lg px-2 py-1 font-display text-[17px] font-semibold hover:bg-sunken"
          aria-label={`${formatDate(month, "monthYear")}: choose a year`}
        >
          {formatDate(month, "monthYear")}
          <Icon.Chevron size={14} className="text-ink-3" />
        </button>
        <button type="button" onClick={() => setMonth(addMonths(month, 1))} aria-label="Next month" className={nav}>
          <Icon.ChevronRight size={16} />
        </button>
      </div>
      <div className="grid grid-cols-7 text-center">
        {WEEKDAYS.map((d, i) => (
          <span key={i} className={cn("pb-1 text-[11px] font-semibold", i >= 5 ? "text-weekend" : "text-ink-3")}>
            {d}
          </span>
        ))}
        {Array.from({ length: cells }, (_, k) => {
          const day = addDays(gridStart, k);
          const inMonth = day.slice(0, 7) === month.slice(0, 7);
          const off = (min && day < min) || (max && day > max);
          const sel = day === value;
          return (
            <button
              key={day}
              type="button"
              disabled={!!off}
              onClick={() => onPick(day)}
              aria-label={formatDate(day, "long")}
              aria-pressed={sel}
              className={cn(
                "mx-auto flex h-9 w-9 items-center justify-center rounded-full text-[14px] tabular-nums disabled:opacity-25",
                sel
                  ? "bg-teal font-semibold text-white"
                  : day === today
                    ? "font-semibold text-clay-ink ring-1 ring-clay ring-inset"
                    : weekday(day) >= 5
                      ? "text-weekend hover:bg-weekend-soft"
                      : "hover:bg-sunken",
                !inMonth && !sel && "opacity-40",
              )}
            >
              {Number(day.slice(8))}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function DatePicker({
  value,
  onChange,
  label,
  min,
  max,
  placeholder = "Pick a date",
  clearable,
  look = "field",
  className,
  format = "fullYear",
}: {
  value: string | null;
  onChange: (v: string | null) => void;
  label: string;
  min?: string;
  max?: string;
  placeholder?: string;
  clearable?: boolean;
  look?: Look;
  className?: string;
  format?: "fullYear" | "dayMonthYear";
}) {
  const [open, setOpen] = useState(false);
  const today = todayLocal();
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button type="button" aria-label={`${label}: ${value ? formatDate(value, "long") : "not set"}`} className={cn(triggerCls(look, open), className)}>
          <span className={cn("truncate tabular-nums", !value && "text-ink-3")}>{value ? formatDate(value, format) : placeholder}</span>
          <Icon.Calendar size={17} className="shrink-0 text-ink-3" />
        </button>
      </Popover.Trigger>
      <PopoverPanel align={look === "inline" ? "end" : "start"}>
        <MonthPicker
          key={value ?? "none"}
          value={value}
          min={min}
          max={max}
          onPick={(d) => {
            onChange(d);
            setOpen(false);
          }}
        />
        <div className="mt-2 flex items-center justify-between border-t border-line-soft pt-2">
          <button
            type="button"
            disabled={(!!min && today < min) || (!!max && today > max)}
            onClick={() => {
              onChange(today);
              setOpen(false);
            }}
            className="h-9 rounded-lg px-3 text-[14px] font-semibold text-clay-ink hover:bg-sunken disabled:opacity-30"
          >
            Today
          </button>
          {clearable && value ? (
            <button
              type="button"
              onClick={() => {
                onChange(null);
                setOpen(false);
              }}
              className="h-9 rounded-lg px-3 text-[14px] font-medium text-ink-2 hover:bg-sunken"
            >
              Clear
            </button>
          ) : null}
        </div>
      </PopoverPanel>
    </Popover.Root>
  );
}

// ─── Time ────────────────────────────────────────────────────────────────────

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Type the exact time (10:34), nudge it a minute either way, or tap a quick hour and minute.
 * The boxes take digits only and jump from the hour to the minutes once two are typed.
 */
/**
 * The digits now in a two-digit time box. Typing into a box that's already full starts it again with
 * the new digit (as if its contents were selected), so "10" over "09" gives 10, not 09 or 91.
 */
function fresh(typed: string, before: string) {
  const d = typed.replace(/\D/g, "");
  if (d.length <= 2) return d;
  const added = d.length - before.length;
  return added > 0 ? d.replace(before, "").slice(0, 2) || d.slice(-added) : d.slice(0, 2);
}

function ExactTime({ value, onChange, onDone }: { value: string; onChange: (v: string) => void; onDone: () => void }) {
  const [prev, setPrev] = useState(value);
  const [hh, setHh] = useState(value.slice(0, 2));
  const [mm, setMm] = useState(value.slice(3, 5));
  // Follow changes made with the grids or the nudge buttons, but not our own typing.
  if (value !== prev) {
    setPrev(value);
    if (`${pad(Number(hh) || 0)}:${pad(Number(mm) || 0)}` !== value) {
      setHh(value.slice(0, 2));
      setMm(value.slice(3, 5));
    }
  }
  const commit = (h: string, m: string) => {
    const H = Math.min(23, Number(h) || 0);
    const M = Math.min(59, Number(m) || 0);
    onChange(`${pad(H)}:${pad(M)}`);
  };
  const nudge = (d: number) => {
    const t = (((Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5)) + d) % 1440) + 1440) % 1440;
    onChange(`${pad(Math.floor(t / 60))}:${pad(t % 60)}`);
  };
  const box =
    "h-14 w-[68px] rounded-xl border border-line-2 bg-bg text-center font-display text-[30px] font-semibold tabular-nums outline-none focus:border-teal focus:ring-2 focus:ring-teal/25";
  const nudgeBtn = "flex h-10 min-w-11 items-center justify-center rounded-xl bg-sunken px-2 text-[13px] font-semibold text-ink-2 hover:text-ink";
  return (
    <div className="mb-3 flex items-center justify-between gap-2 border-b border-line-soft pb-3">
      <button type="button" onClick={() => nudge(-1)} aria-label="One minute earlier" className={nudgeBtn}>
        −1
      </button>
      <div className="flex items-center gap-1.5">
        <input
          value={hh}
          inputMode="numeric"
          enterKeyHint="next"
          maxLength={2}
          aria-label="Hour"
          onFocus={(e) => e.target.select()}
          onMouseUp={(e) => e.preventDefault()}
          onChange={(e) => {
            const v = fresh(e.target.value, hh);
            setHh(v);
            if (v.length === 2) {
              commit(v, mm);
              (e.target.parentElement?.querySelector("[aria-label=Minutes]") as HTMLInputElement | null)?.focus();
            }
          }}
          onBlur={(e) => {
            // Read the box itself: the jump to the minutes blurs it before React has re-rendered.
            const H = Math.min(23, Number(e.target.value) || 0);
            setHh(pad(H));
            commit(String(H), e.target.parentElement?.querySelector<HTMLInputElement>("[aria-label=Minutes]")?.value ?? mm);
          }}
          onKeyDown={(e) => e.key === "Enter" && (e.currentTarget.parentElement?.querySelector("[aria-label=Minutes]") as HTMLInputElement | null)?.focus()}
          className={box}
        />
        <span className="font-display text-[28px] font-semibold text-ink-3">:</span>
        <input
          value={mm}
          inputMode="numeric"
          enterKeyHint="done"
          maxLength={2}
          aria-label="Minutes"
          onFocus={(e) => e.target.select()}
          onMouseUp={(e) => e.preventDefault()}
          onChange={(e) => {
            const v = fresh(e.target.value, mm);
            setMm(v);
            if (v.length === 2) commit(hh, v);
          }}
          onBlur={(e) => {
            const M = Math.min(59, Number(e.target.value) || 0);
            setMm(pad(M));
            commit(e.target.parentElement?.querySelector<HTMLInputElement>("[aria-label=Hour]")?.value ?? hh, String(M));
          }}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            e.preventDefault();
            commit(hh, mm);
            onDone();
          }}
          className={box}
        />
      </div>
      <button type="button" onClick={() => nudge(1)} aria-label="One minute later" className={nudgeBtn}>
        +1
      </button>
    </div>
  );
}

export function TimePicker({ value, onChange, label, className }: { value: string; onChange: (v: string) => void; label: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const h = Number(value.slice(0, 2)) || 0;
  const m = Number(value.slice(3, 5)) || 0;
  const chip = (on: boolean) => cn("h-9 rounded-lg text-[14px] tabular-nums", on ? "bg-teal font-semibold text-white" : "hover:bg-sunken");
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button type="button" aria-label={`${label}: ${value}`} className={cn(triggerCls("field", open), "tabular-nums", className)}>
          <span>{value}</span>
          <Icon.Clock size={17} className="shrink-0 text-ink-3" />
        </button>
      </Popover.Trigger>
      <PopoverPanel className="w-[284px]">
        <ExactTime value={value} onChange={onChange} onDone={() => setOpen(false)} />
        <div className="mb-1 text-[12px] font-semibold tracking-[0.6px] text-ink-3 uppercase">Hour</div>
        <div className="grid grid-cols-6 gap-1">
          {Array.from({ length: 24 }, (_, i) => (
            <button key={i} type="button" aria-pressed={i === h} onClick={() => onChange(`${pad(i)}:${pad(m)}`)} className={chip(i === h)}>
              {pad(i)}
            </button>
          ))}
        </div>
        <div className="mt-3 mb-1 text-[12px] font-semibold tracking-[0.6px] text-ink-3 uppercase">Quick minutes</div>
        <div className="grid grid-cols-6 gap-1">
          {Array.from({ length: 12 }, (_, i) => i * 5).map((mm) => (
            <button
              key={mm}
              type="button"
              aria-pressed={mm === m}
              onClick={() => {
                onChange(`${pad(h)}:${pad(mm)}`);
                setOpen(false);
              }}
              className={chip(mm === m)}
            >
              :{pad(mm)}
            </button>
          ))}
        </div>
        <button type="button" onClick={() => setOpen(false)} className="mt-3 h-10 w-full rounded-xl bg-ink text-[14px] font-semibold text-bg">
          Done
        </button>
      </PopoverPanel>
    </Popover.Root>
  );
}

// ─── Colour ──────────────────────────────────────────────────────────────────

function hslHex(h: number, s: number, l: number) {
  const a = (s / 100) * Math.min(l / 100, 1 - l / 100);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const c = l / 100 - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(c * 255)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

/** Every hue in four strengths, then greys: enough choice without a fiddly colour wheel. */
const MORE_COLORS = [
  ...[0, 20, 35, 50, 90, 140, 170, 195, 215, 240, 265, 290, 320, 340].flatMap((h) => [hslHex(h, 70, 78), hslHex(h, 65, 60), hslHex(h, 60, 45), hslHex(h, 60, 32)]),
  "#d8d2ca",
  "#a39b91",
  "#6b6259",
  "#3a332b",
];

export function ColorPicker({ value, onChange, presets }: { value: string; onChange: (hex: string) => void; presets: string[] }) {
  const [open, setOpen] = useState(false);
  const [hex, setHex] = useState(value);
  const custom = !presets.includes(value);
  return (
    <Popover.Root
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v) setHex(value);
      }}
    >
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label="More colours"
          className={cn("flex h-9 w-9 items-center justify-center rounded-full text-white", custom && "ring-2 ring-ink ring-offset-2 ring-offset-bg")}
          style={{ background: custom ? value : "conic-gradient(#d14b3a, #d9a520, #4caf7d, #1e96c8, #8e44ad, #d14b3a)" }}
        >
          {custom ? <Icon.Check size={16} /> : <Icon.Plus size={16} />}
        </button>
      </Popover.Trigger>
      <PopoverPanel align="end" className="w-[296px]">
        <div className="text-[12px] font-semibold tracking-[0.6px] text-ink-3 uppercase">More colours</div>
        <div className="mt-2 grid grid-cols-8 gap-1.5">
          {MORE_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={c}
              aria-pressed={c === value}
              onClick={() => {
                onChange(c);
                setOpen(false);
              }}
              className={cn("h-7 w-7 rounded-full", c === value && "ring-2 ring-ink ring-offset-2 ring-offset-surface")}
              style={{ background: c }}
            />
          ))}
        </div>
        <form
          className="mt-3 flex items-center gap-2 border-t border-line-soft pt-3"
          onSubmit={(e) => {
            // The panel is portalled, but React still bubbles its submit to the form it was opened from.
            e.preventDefault();
            e.stopPropagation();
            const v = hex.trim().startsWith("#") ? hex.trim() : `#${hex.trim()}`;
            if (/^#[0-9a-f]{6}$/i.test(v)) {
              onChange(v.toLowerCase());
              setOpen(false);
            }
          }}
        >
          <span className="h-9 w-9 shrink-0 rounded-full border border-line" style={{ background: /^#?[0-9a-f]{6}$/i.test(hex.trim()) ? (hex.trim().startsWith("#") ? hex.trim() : `#${hex.trim()}`) : value }} />
          <input
            value={hex}
            onChange={(e) => setHex(e.target.value.slice(0, 7))}
            aria-label="Colour code"
            placeholder="#4a5fc1"
            spellCheck={false}
            autoCapitalize="off"
            className="h-9 min-w-0 flex-1 rounded-lg border border-line-2 bg-bg px-2.5 font-mono text-[14px] outline-none focus:border-ink"
          />
          <button type="submit" className="h-9 rounded-lg bg-ink px-3 text-[14px] font-semibold text-bg">
            Use
          </button>
        </form>
      </PopoverPanel>
    </Popover.Root>
  );
}

// ─── Checkbox, stepper, numbers ─────────────────────────────────────────────

export function Checkbox({ checked, onChange, label, id }: { checked: boolean; onChange: (v: boolean) => void; label: string; id?: string }) {
  return (
    <button
      id={id}
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        "flex h-6 w-6 shrink-0 items-center justify-center rounded-[7px] border-[1.5px] transition-colors",
        checked ? "border-teal bg-teal text-white" : "border-line-2 bg-surface hover:border-ink-3",
      )}
    >
      {checked ? <Icon.Check size={15} /> : null}
    </button>
  );
}

export function Stepper({ value, onChange, min, max, label, unit }: { value: number; onChange: (n: number) => void; min: number; max: number; label: string; unit?: (n: number) => string }) {
  const btn = "flex h-8 w-8 items-center justify-center rounded-[9px] text-[18px] leading-none hover:bg-surface disabled:opacity-30";
  return (
    <div className="flex items-center gap-0.5 rounded-xl bg-sunken p-0.5" role="group" aria-label={label}>
      <button type="button" aria-label={`Fewer ${label}`} disabled={value <= min} onClick={() => onChange(value - 1)} className={btn}>
        −
      </button>
      <span className="min-w-14 text-center text-[14px] font-semibold tabular-nums" aria-live="polite">
        {unit ? unit(value) : value}
      </span>
      <button type="button" aria-label={`More ${label}`} disabled={value >= max} onClick={() => onChange(value + 1)} className={btn}>
        +
      </button>
    </div>
  );
}

/** Keeps what's typed in a number box to digits, one point and (optionally) a leading minus. */
export function cleanNumber(s: string, negative = false) {
  let out = s.replace(negative ? /[^0-9.-]/g : /[^0-9.]/g, "");
  if (negative) out = out.replace(/(?!^)-/g, "");
  const dot = out.indexOf(".");
  return dot === -1 ? out : out.slice(0, dot + 1) + out.slice(dot + 1).replace(/\./g, "");
}
