"use client";

import { useState } from "react";
import { LIST_ICONS, ListGlyph } from "@/components/icons";
import { LIST_COLORS, tileStyle } from "@/components/ui/bits";
import { Sheet } from "@/components/ui/sheet";
import { useSpace } from "@/components/app/SpaceProvider";
import { cn } from "@/lib/client/util";
import type { List, ListColor } from "@/lib/types";

const EMOJI = ["✈️", "🍜", "🎁", "🏡", "🎬", "📚", "🌿", "☕", "🎟️", "🧺"];

/** Create a list (no `list`) or rename/restyle one. */
export function ListEditor({
  open,
  onOpenChange,
  list,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  list?: List;
  onCreated?: (id: string) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={list ? "Edit list" : "New list"}>
      <ListForm list={list} onCreated={onCreated} onDone={() => onOpenChange(false)} />
    </Sheet>
  );
}

function ListForm({ list, onCreated, onDone }: { list?: List; onCreated?: (id: string) => void; onDone: () => void }) {
  const { data, actions } = useSpace();
  const [name, setName] = useState(list?.name ?? "");
  const [emoji, setEmoji] = useState(list?.emoji ?? "icon:star");
  const [color, setColor] = useState<ListColor>(
    () => list?.color ?? LIST_COLORS[data.lists.length % LIST_COLORS.length],
  );

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    const n = name.trim();
    if (!n) return;
    if (list) actions.updateList(list.id, { name: n, emoji, color });
    else onCreated?.(actions.createList({ name: n, emoji, color }));
    onDone();
  };

  return (
      <form onSubmit={save} className="flex flex-col gap-5 pt-2">
        <div className="flex items-center gap-3">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[14px]" style={tileStyle(color)}>
            <ListGlyph emoji={emoji} size={26} />
          </div>
          <div className="flex flex-1 flex-col gap-1.5">
            <label htmlFor="list-name" className="text-[14px] font-semibold">
              Name
            </label>
            <input
              id="list-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Weekend plans"
              maxLength={80}
              autoFocus
              className="h-12 rounded-xl border-[1.5px] border-ink bg-surface px-3.5 text-[16px] outline-none"
            />
          </div>
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-[14px] font-semibold">Icon</legend>
          <div className="grid grid-cols-5 gap-2">
            {[...Object.keys(LIST_ICONS), ...EMOJI].map((k) => (
              <button
                key={k}
                type="button"
                aria-label={k.startsWith("icon:") ? k.slice(5) : k}
                aria-pressed={emoji === k}
                onClick={() => setEmoji(k)}
                className={cn(
                  "flex h-12 items-center justify-center rounded-xl border",
                  emoji === k ? "border-ink bg-surface" : "border-transparent bg-sunken text-ink-2",
                )}
              >
                <ListGlyph emoji={k} size={22} />
              </button>
            ))}
          </div>
          <label className="mt-1 flex items-center gap-2 text-[14px] text-ink-2">
            Or type any emoji
            <input
              value={emoji.startsWith("icon:") ? "" : emoji}
              onChange={(e) => {
                const v = [...e.target.value.trim()].slice(-2).join("");
                if (v) setEmoji(v);
              }}
              className="h-10 w-16 rounded-lg border border-line-2 bg-surface text-center text-[18px] outline-none"
              aria-label="Custom emoji"
            />
          </label>
        </fieldset>

        <fieldset>
          <legend className="mb-2 text-[14px] font-semibold">Colour</legend>
          <div className="flex gap-2.5">
            {LIST_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={c}
                aria-pressed={color === c}
                onClick={() => setColor(c)}
                className={cn("h-11 w-11 rounded-full border-2", color === c ? "border-ink" : "border-transparent")}
                style={{ background: `var(--tile-${c}-bg)` }}
              >
                <span className="mx-auto block h-4 w-4 rounded-full" style={{ background: `var(--tile-${c}-fg)` }} />
              </button>
            ))}
          </div>
        </fieldset>

        <button type="submit" disabled={!name.trim()} className="h-[52px] rounded-[14px] bg-clay text-[16px] font-semibold text-on-clay disabled:opacity-50">
          {list ? "Save" : "Create list"}
        </button>
      </form>
  );
}
