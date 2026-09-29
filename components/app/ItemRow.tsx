"use client";

import { motion } from "framer-motion";
import { Icon } from "@/components/icons";
import { Avatar, StatusPill } from "@/components/ui/bits";
import { useSpace } from "@/components/app/SpaceProvider";
import { PhotoThumb } from "@/components/app/Photo";
import { useHighlight } from "@/lib/client/store";
import { cn } from "@/lib/client/util";
import { domain, money, shortDate, targetDate } from "@/lib/format";
import type { Item } from "@/lib/types";

export function DoneToggle({ item, size = 28 }: { item: Item; size?: number }) {
  const { actions } = useSpace();
  const done = item.status === "done";
  return (
    <button
      type="button"
      aria-label={done ? `Mark “${item.title}” not done` : `Mark “${item.title}” done`}
      aria-pressed={done}
      onClick={(e) => {
        e.stopPropagation();
        actions.updateItem(item.id, { status: done ? "idea" : "done" });
      }}
      className="relative flex h-11 w-11 shrink-0 items-center justify-center -m-2"
    >
      <span
        className={cn(
          "flex items-center justify-center rounded-full border-2 transition-colors",
          done ? "border-teal bg-teal text-white" : "border-radio bg-surface",
        )}
        style={{ width: size, height: size }}
      >
        {done ? <Icon.Check size={size * 0.55} /> : null}
      </span>
    </button>
  );
}

export function ItemMeta({ item }: { item: Item }) {
  const { data } = useSpace();
  const labels = data.space.priority_labels;
  const bits: React.ReactNode[] = [];
  if (item.status === "done") {
    bits.push(<span key="d">Done {shortDate(item.done_at)}</span>);
  } else {
    bits.push(<StatusPill key="s" status={item.status} />);
  }
  if (item.priority !== null && item.status !== "done")
    bits.push(
      <span key="p" className={item.priority === 2 ? "font-semibold text-clay-ink" : undefined}>
        {labels[item.priority]}
      </span>,
    );
  if (item.price !== null) bits.push(<span key="m">{money(item.price, item.currency ?? data.space.default_currency)}</span>);
  if (item.target_date && item.status !== "done") bits.push(<span key="t">{targetDate(item.target_date)}</span>);
  if (item.url && bits.length < 4) bits.push(<span key="u" className="truncate">{domain(item.url)}</span>);
  return <>{bits}</>;
}

export function ItemRow({ item, selected, onOpen }: { item: Item; selected?: boolean; onOpen: () => void }) {
  const { data, me } = useSpace();
  const hl = useHighlight(item.id);
  const photo = data.photos.find((p) => p.item_id === item.id);
  const byOther = hl && (hl === "added" ? item.added_by : item.updated_by);

  return (
    <motion.li
      layout="position"
      initial={false}
      animate={{ backgroundColor: hl ? "var(--highlight)" : selected ? "var(--surface)" : "rgba(0,0,0,0)" }}
      transition={{ duration: 0.5 }}
      className={cn(
        "flex items-center gap-3 rounded-[14px] px-2 py-2.5",
        hl && "shadow-[inset_0_0_0_1.5px_var(--teal)]",
        selected && !hl && "shadow-[inset_0_0_0_2px_var(--ink)]",
      )}
    >
      <DoneToggle item={item} />
      <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 flex-col gap-1 text-left">
        <span
          className={cn(
            "text-[16px] font-semibold leading-snug break-words",
            item.status === "done" && "text-ink-3 line-through decoration-1",
          )}
        >
          {item.title}
        </span>
        {byOther ? (
          <span className="flex items-center gap-2 text-[13px] font-medium text-teal-text">
            <Avatar name={byOther} members={data.space.member_names} size={18} ring="none" />
            {hl === "added" ? "Just added" : "Just edited"}
            {item.url ? ` · ${domain(item.url)}` : ""}
          </span>
        ) : (
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-ink-3">
            <ItemMeta item={item} />
            {item.added_by && item.added_by !== me && data.space.member_names.length > 1 ? (
              <Avatar name={item.added_by} members={data.space.member_names} size={16} ring="none" className="ml-auto" />
            ) : null}
          </span>
        )}
      </button>
      {photo ? <PhotoThumb photo={photo} size={56} onClick={onOpen} /> : null}
    </motion.li>
  );
}
