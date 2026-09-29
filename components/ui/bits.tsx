"use client";

import { initial } from "@/lib/format";
import { cn } from "@/lib/client/util";
import type { ListColor } from "@/lib/types";

const AVATAR_COLORS = ["var(--clay)", "var(--teal)", "#6e3e6a", "#5c5a2a"];

export function avatarColor(name: string | null | undefined, members: string[]) {
  if (!name) return "var(--ink-3)";
  const i = members.indexOf(name);
  if (i >= 0) return AVATAR_COLORS[i % AVATAR_COLORS.length];
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

export function Avatar({
  name,
  members,
  size = 32,
  ring = "var(--bg)",
  className,
}: {
  name: string | null | undefined;
  members: string[];
  size?: number;
  ring?: string;
  className?: string;
}) {
  return (
    <span
      title={name ?? undefined}
      className={cn("flex shrink-0 items-center justify-center rounded-full font-semibold text-white", className)}
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.4),
        background: avatarColor(name, members),
        boxShadow: ring === "none" ? undefined : `0 0 0 2px ${ring}`,
      }}
    >
      {initial(name)}
    </span>
  );
}

export function HereIndicator({ here, className }: { here: string[]; className?: string }) {
  if (!here.length) return null;
  const label = here.length === 1 ? `${here[0]} is here` : `${here.slice(0, -1).join(", ")} and ${here.at(-1)} are here`;
  return (
    <div className={cn("flex items-center gap-1.5 text-[13px] font-medium text-teal-text", className)} aria-live="polite">
      <span className="h-2 w-2 rounded-full bg-online" />
      <span className="truncate">{label}</span>
    </div>
  );
}

export function tileStyle(color: ListColor | string) {
  return { background: `var(--tile-${color}-bg)`, color: `var(--tile-${color}-fg)` };
}

export const LIST_COLORS: ListColor[] = ["clay", "teal", "plum", "olive", "sky", "rose"];

export function StatusPill({ status }: { status: "idea" | "planned" | "done" }) {
  if (status === "planned")
    return <span className="rounded-md bg-teal-soft px-2 py-0.5 font-medium text-teal-ink">Planned</span>;
  if (status === "done") return <span className="rounded-md bg-teal-soft px-2 py-0.5 font-medium text-teal-ink">Done</span>;
  return <span className="rounded-md bg-pill-idea px-2 py-0.5 font-medium text-pill-idea-ink">Idea</span>;
}

export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  label,
  size = "md",
  allowClear,
}: {
  value: T | null;
  options: { value: T; label: string }[];
  onChange: (v: T | null) => void;
  label: string;
  size?: "sm" | "md";
  allowClear?: boolean;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="grid gap-1 rounded-xl bg-sunken p-1"
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on && allowClear ? null : o.value)}
            className={cn(
              "truncate rounded-[9px] px-1 transition-colors",
              size === "md" ? "h-10 text-[15px]" : "h-9 text-[14px]",
              on ? "bg-teal font-semibold text-white" : "font-medium text-ink-2 hover:text-ink",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Logo({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={(size * 22) / 36} viewBox="0 0 64 40" fill="none" strokeWidth="4" aria-hidden="true">
      <circle cx="22" cy="20" r="15" stroke="var(--clay)" />
      <circle cx="42" cy="20" r="15" stroke="var(--teal-text)" />
    </svg>
  );
}
