"use client";

import { motion } from "framer-motion";
import { Icon } from "@/components/icons";
import { Avatar, StatusPill } from "@/components/ui/bits";
import { useSpace } from "@/components/app/SpaceProvider";
import { PhotoThumb } from "@/components/app/Photo";
import { useHighlight } from "@/lib/client/store";
import { cn } from "@/lib/client/util";
import { domain, money, shortDate, targetDate } from "@/lib/format";
import { BUILTIN_ROW_FIELDS, DEFAULT_ROW_FIELDS, type RowField } from "@/lib/client/rowFields";
import type { FieldDef, Item } from "@/lib/types";

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

type FieldCtx = { labels: string[]; currency: string; me: string | null; members: string[]; defs: FieldDef[] };

function useFieldCtx(listId: string): FieldCtx {
  const { data, me } = useSpace();
  return {
    labels: data.space.priority_labels,
    currency: data.space.default_currency,
    me,
    members: data.space.member_names,
    defs: data.fields.filter((f) => f.list_id === listId),
  };
}

/** One detail of an item, or null when the item has nothing to show for it. */
export function fieldContent(field: RowField, item: Item, ctx: FieldCtx, bare = false): React.ReactNode | null {
  const done = item.status === "done";
  switch (field) {
    case "status":
      return done ? <span>Done {shortDate(item.done_at)}</span> : <StatusPill status={item.status} />;
    case "priority":
      if (item.priority === null || done) return null;
      return <span className={item.priority === 2 ? "font-semibold text-clay-ink" : undefined}>{ctx.labels[item.priority]}</span>;
    case "who":
      if (!item.who_wants) return null;
      const who = item.who_wants === "Both" ? "both" : item.who_wants === ctx.me ? "me" : item.who_wants;
      return <span>{bare ? who.charAt(0).toUpperCase() + who.slice(1) : `For ${who}`}</span>;
    case "price":
      return item.price === null ? null : <span>{money(item.price, item.currency ?? ctx.currency)}</span>;
    case "date":
      return item.target_date && !done ? <span>{targetDate(item.target_date)}</span> : null;
    case "location":
      return item.location ? <span className="max-w-[16ch] truncate">{item.location}</span> : null;
    case "link":
      return item.url ? <span className="max-w-[18ch] truncate">{domain(item.url)}</span> : null;
    case "tags":
      return item.tags.length ? <span className="truncate">{item.tags.slice(0, 3).map((t) => `#${t}`).join(" ")}</span> : null;
    case "notes":
      return item.notes ? <span className="max-w-[28ch] truncate italic">{item.notes.split("\n")[0]}</span> : null;
    case "added":
      return item.added_by ? <Avatar name={item.added_by} members={ctx.members} size={16} ring="none" /> : null;
    default: {
      const def = ctx.defs.find((d) => `custom:${d.key}` === field);
      const v = def ? item.custom[def.key] : null;
      if (!def || v === null || v === undefined || v === "" || v === false) return null;
      if (def.type === "checkbox") return <span>{bare ? "Yes" : `✓ ${def.label}`}</span>;
      const shown = def.type === "date" ? targetDate(String(v)) : def.type === "link" ? domain(String(v)) : String(v);
      // In a table the column header already names the field.
      return <span className="max-w-[22ch] truncate">{bare ? shown : `${def.label}: ${shown}`}</span>;
    }
  }
}

/** The details shown under an item's title, in the order the picker lists them. */
export function ItemMeta({ item, fields = DEFAULT_ROW_FIELDS }: { item: Item; fields?: RowField[] }) {
  const ctx = useFieldCtx(item.list_id);
  const { me } = useSpace();
  // The avatar goes last, at the end of the line.
  const order = [
    ...BUILTIN_ROW_FIELDS.map((f) => f.key).filter((k) => k !== "added"),
    ...ctx.defs.sort((a, b) => a.position - b.position).map((d) => `custom:${d.key}` as RowField),
    "added" as RowField,
  ];
  return (
    <>
      {order
        .filter((f) => fields.includes(f))
        // Your own items don't need your face on them, and a solo space never does.
        .filter((f) => f !== "added" || (item.added_by !== me && ctx.members.length > 1))
        .map((f) => {
          const c = fieldContent(f, item, ctx);
          return c === null ? null : (
            <span key={f} className={cn("flex min-w-0 items-center", f === "added" && "ml-auto")}>
              {c}
            </span>
          );
        })}
    </>
  );
}

export function ItemRow({
  item,
  selected,
  onOpen,
  fields = DEFAULT_ROW_FIELDS,
}: {
  item: Item;
  selected?: boolean;
  onOpen: () => void;
  fields?: RowField[];
}) {
  const { data } = useSpace();
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
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-ink-3 empty:hidden">
            <ItemMeta item={item} fields={fields} />
          </span>
        )}
      </button>
      {photo ? <PhotoThumb photo={photo} size={56} onClick={onOpen} /> : null}
    </motion.li>
  );
}
