"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useMemo, useRef, useState } from "react";
import { Icon, ListGlyph } from "@/components/icons";
import { Avatar, HereIndicator, StatusPill, tileStyle } from "@/components/ui/bits";
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { Sheet } from "@/components/ui/sheet";
import { useSpace } from "@/components/app/SpaceProvider";
import { DoneToggle, ItemRow } from "@/components/app/ItemRow";
import { ListEditor } from "@/components/app/ListEditor";
import { FieldsEditor } from "@/components/app/FieldsEditor";
import { filterItems, NO_FILTERS, sortItems, SORTS, type Filters, type SortKey } from "@/lib/client/items";
import { useHighlight } from "@/lib/client/store";
import { useNav } from "@/lib/client/nav";
import { cn, storage } from "@/lib/client/util";
import { initial, money, shortDate, targetDate } from "@/lib/format";
import type { Item, List } from "@/lib/types";

function addPlaceholder(list: List) {
  const n = list.name.toLowerCase();
  if (n.includes("place") || n.includes("go")) return "Add a place…";
  if (n.includes("buy") || n.includes("shop")) return "Add something to buy…";
  if (n.includes("date")) return "Add a date idea…";
  return "Add an idea…";
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        "h-9 shrink-0 rounded-full px-3.5 text-[14px] whitespace-nowrap transition-colors",
        on ? "bg-ink font-medium text-bg" : "border border-line-2 text-ink hover:bg-sunken",
      )}
    >
      {children}
    </button>
  );
}

export function ListView({ list }: { list: List }) {
  const { data, actions, here, me } = useSpace();
  const { route, go } = useNav();
  const [title, setTitle] = useState("");
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [sort, setSortState] = useState<SortKey>(() => (storage.get(`ours:sort:${list.id}`) as SortKey) || "newest");
  const [showDone, setShowDone] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editingFields, setEditingFields] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const setSort = (s: SortKey) => {
    setSortState(s);
    storage.set(`ours:sort:${list.id}`, s);
  };

  const all = useMemo(() => data.items.filter((i) => i.list_id === list.id), [data.items, list.id]);
  const open = all.filter((i) => i.status !== "done");
  const done = useMemo(
    () => all.filter((i) => i.status === "done").sort((a, b) => (b.done_at ?? "").localeCompare(a.done_at ?? "")),
    [all],
  );
  const shown = useMemo(() => sortItems(filterItems(open, filters), sort), [open, filters, sort]);
  const people = useMemo(
    () => [...new Set([...data.space.member_names, ...all.map((i) => i.added_by).filter(Boolean)])] as string[],
    [data.space.member_names, all],
  );

  const add = (e?: React.FormEvent) => {
    e?.preventDefault();
    const t = title.trim();
    if (!t) return;
    actions.addItem(list.id, t);
    setTitle("");
    inputRef.current?.focus();
  };

  const openItem = (id: string) => go({ list: list.id, item: id });
  const counts = {
    idea: open.filter((i) => i.status === "idea").length,
    planned: open.filter((i) => i.status === "planned").length,
  };
  const sortLabel = SORTS.find((s) => s.key === sort)?.label;

  const sortMenu = (
    <Menu>
      <MenuTrigger className="flex h-10 items-center gap-1 rounded-[10px] px-2 text-[13px] font-medium text-ink hover:bg-sunken lg:border lg:border-line-2 lg:px-3.5 lg:text-[14px] lg:font-normal">
        Sort: {sortLabel}
        <Icon.Chevron size={14} />
      </MenuTrigger>
      <MenuContent>
        <MenuLabel>Sort by</MenuLabel>
        {SORTS.map((s) => (
          <MenuItem key={s.key} checked={s.key === sort} onSelect={() => setSort(s.key)}>
            {s.label}
          </MenuItem>
        ))}
      </MenuContent>
    </Menu>
  );

  return (
    <div className="flex min-h-full flex-col pb-28 lg:pb-10">
      {/* Mobile header */}
      <header className="flex items-center justify-between px-2 pt-3 safe-top lg:hidden">
        <button
          type="button"
          onClick={() => go({})}
          aria-label="Back to lists"
          className="flex h-11 w-11 items-center justify-center rounded-xl hover:bg-sunken"
        >
          <Icon.Back />
        </button>
        <HereIndicator here={here} />
        <ListOptions
          onEdit={() => setEditing(true)}
          onFields={() => setEditingFields(true)}
          onArchive={() => {
            actions.updateList(list.id, { archived_at: new Date().toISOString() });
            go({});
          }}
          onDelete={() => setConfirmDelete(true)}
        />
      </header>

      <div className="flex items-center gap-3 px-5 pt-1 lg:px-10 lg:pt-8">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] lg:hidden" style={tileStyle(list.color)}>
          <ListGlyph emoji={list.emoji} size={22} />
        </div>
        <h1 className="min-w-0 flex-1 truncate font-display text-[30px] font-semibold tracking-[-0.4px] lg:text-[38px] lg:tracking-[-0.5px]">
          {list.name}
        </h1>
        <div className="hidden items-center gap-2 lg:flex">
          {sortMenu}
          <ListOptions
            onEdit={() => setEditing(true)}
            onFields={() => setEditingFields(true)}
            onArchive={() => {
              actions.updateList(list.id, { archived_at: new Date().toISOString() });
              go({});
            }}
            onDelete={() => setConfirmDelete(true)}
          />
        </div>
      </div>

      <form onSubmit={add} className="px-5 pt-4 lg:px-10">
        <div className="flex h-[52px] items-center gap-2 rounded-[14px] border-[1.5px] border-ink bg-surface pr-1.5 pl-4">
          <label htmlFor="add-item" className="sr-only">
            {addPlaceholder(list)}
          </label>
          <input
            id="add-item"
            ref={inputRef}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={addPlaceholder(list)}
            autoComplete="off"
            enterKeyHint="done"
            maxLength={300}
            className="min-w-0 flex-1 bg-transparent text-[17px] outline-none lg:text-[16px]"
          />
          <button
            type="submit"
            aria-label="Add"
            className="flex h-10 w-11 items-center justify-center rounded-[10px] bg-clay text-on-clay lg:w-auto lg:px-4 lg:text-[14px] lg:font-semibold"
          >
            <Icon.Plus size={20} className="lg:hidden" />
            <span className="hidden lg:inline">Add</span>
          </button>
        </div>
      </form>

      <div className="no-scrollbar flex gap-2 overflow-x-auto px-5 pt-3.5 lg:px-10">
        <Chip on={filters.status === "all"} onClick={() => setFilters({ ...filters, status: "all" })}>
          All {open.length}
        </Chip>
        <Chip on={filters.status === "idea"} onClick={() => setFilters({ ...filters, status: filters.status === "idea" ? "all" : "idea" })}>
          Idea {counts.idea}
        </Chip>
        <Chip
          on={filters.status === "planned"}
          onClick={() => setFilters({ ...filters, status: filters.status === "planned" ? "all" : "planned" })}
        >
          Planned {counts.planned}
        </Chip>
        <Chip on={filters.high} onClick={() => setFilters({ ...filters, high: !filters.high })}>
          <span className="lg:hidden">{data.space.priority_labels[2]}</span>
          <span className="hidden lg:inline">{data.space.priority_labels[2]} priority</span>
        </Chip>
        {people.length > 1
          ? people.map((p) => (
              <Chip key={p} on={filters.by === p} onClick={() => setFilters({ ...filters, by: filters.by === p ? null : p })}>
                <span className="lg:hidden">By {p === me ? "me" : initial(p)}</span>
                <span className="hidden lg:inline">Added by {p === me ? "me" : p}</span>
              </Chip>
            ))
          : null}
      </div>

      <div className="flex items-center justify-between px-5 pt-3 pb-1.5 text-[13px] text-ink-3 lg:hidden">
        <span>
          {shown.length === open.length ? `${open.length} open` : `${shown.length} of ${open.length} open`}
        </span>
        {sortMenu}
      </div>

      {open.length === 0 ? (
        <EmptyState list={list} onFocus={() => inputRef.current?.focus()} />
      ) : shown.length === 0 ? (
        <p className="px-5 py-10 text-center text-[15px] text-ink-3 lg:px-10">
          Nothing matches these filters.{" "}
          <button type="button" className="font-semibold text-clay-ink underline" onClick={() => setFilters(NO_FILTERS)}>
            Clear filters
          </button>
        </p>
      ) : (
        <>
          <ul className="flex flex-col gap-0.5 px-3 lg:hidden">
            <AnimatePresence initial={false}>
              {shown.map((item) => (
                <ItemRow key={item.id} item={item} onOpen={() => openItem(item.id)} selected={route.item === item.id} />
              ))}
            </AnimatePresence>
          </ul>
          <ItemTable items={shown} selectedId={route.item} onOpen={openItem} />
        </>
      )}

      {done.length > 0 ? (
        <section className="mt-2.5 px-5 lg:px-10">
          <button
            type="button"
            aria-expanded={showDone}
            onClick={() => setShowDone((v) => !v)}
            className="flex h-12 w-full items-center justify-between border-t border-line-strong px-1 text-[15px] font-medium text-ink-2 lg:w-auto lg:justify-start lg:gap-2 lg:border-0 lg:px-0 lg:text-[14px]"
          >
            <span className="flex items-center gap-2">
              <Icon.Check size={18} />
              Done · {done.length}
            </span>
            <Icon.ChevronRight size={16} className={cn("transition-transform", showDone && "rotate-90")} />
          </button>
          <AnimatePresence initial={false}>
            {showDone ? (
              <motion.ul
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="-mx-2 flex flex-col gap-0.5 overflow-hidden"
              >
                {done.map((item) => (
                  <ItemRow key={item.id} item={item} onOpen={() => openItem(item.id)} selected={route.item === item.id} />
                ))}
              </motion.ul>
            ) : null}
          </AnimatePresence>
        </section>
      ) : null}

      <ListEditor open={editing} onOpenChange={setEditing} list={list} />
      <FieldsEditor open={editingFields} onOpenChange={setEditingFields} list={list} />
      <Sheet
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete “${list.name}”?`}
        description={`This removes the list and its ${all.length} item${all.length === 1 ? "" : "s"} for both of you. It can't be undone. Archive it instead to keep everything.`}
      >
        <div className="grid grid-cols-2 gap-2.5 pt-2">
          <button
            type="button"
            onClick={() => {
              setConfirmDelete(false);
              actions.updateList(list.id, { archived_at: new Date().toISOString() });
              go({});
            }}
            className="h-[50px] rounded-[14px] border border-line-2 text-[15px] font-medium"
          >
            Archive instead
          </button>
          <button
            type="button"
            onClick={() => {
              setConfirmDelete(false);
              actions.deleteList(list.id);
              go({});
            }}
            className="h-[50px] rounded-[14px] bg-danger text-[15px] font-semibold text-white"
            style={{ background: "#a33a1e" }}
          >
            Delete for good
          </button>
        </div>
      </Sheet>
    </div>
  );
}

function ListOptions({
  onEdit,
  onFields,
  onArchive,
  onDelete,
}: {
  onEdit: () => void;
  onFields: () => void;
  onArchive: () => void;
  onDelete: () => void;
}) {
  return (
    <Menu>
      <MenuTrigger
        aria-label="List options"
        className="flex h-11 w-11 items-center justify-center rounded-xl hover:bg-sunken lg:h-10 lg:w-10 lg:rounded-[10px] lg:border lg:border-line-2"
      >
        <Icon.More />
      </MenuTrigger>
      <MenuContent>
        <MenuItem onSelect={onEdit} icon={<Icon.Star size={18} />}>
          Rename &amp; style
        </MenuItem>
        <MenuItem onSelect={onFields} icon={<Icon.Settings size={18} />}>
          Custom fields
        </MenuItem>
        <MenuSeparator />
        <MenuItem onSelect={onArchive} icon={<Icon.Archive size={18} />}>
          Archive list
        </MenuItem>
        <MenuItem onSelect={onDelete} icon={<Icon.Trash size={18} />} danger>
          Delete list
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}

function EmptyState({ list, onFocus }: { list: List; onFocus: () => void }) {
  return (
    <div className="mx-5 mt-6 flex flex-col items-center gap-3 rounded-2xl border-[1.5px] border-dashed border-dash px-6 py-10 text-center lg:mx-10">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl" style={tileStyle(list.color)}>
        <ListGlyph emoji={list.emoji} />
      </div>
      <p className="max-w-[260px] text-[15px] text-ink-2">Nothing here yet. Type an idea above and press Enter. It shows up for both of you.</p>
      <button type="button" onClick={onFocus} className="text-[14px] font-semibold text-clay-ink">
        Add the first one
      </button>
    </div>
  );
}

function TableRow({ item, selected, onOpen }: { item: Item; selected: boolean; onOpen: () => void }) {
  const { data } = useSpace();
  const hl = useHighlight(item.id);
  const labels = data.space.priority_labels;
  const cell = "px-2.5 py-3 border-t border-line";
  return (
    <tr
      onClick={onOpen}
      className={cn("cursor-pointer transition-colors hover:bg-surface", selected && "bg-surface")}
      style={{
        background: hl ? "var(--highlight)" : undefined,
        boxShadow: hl ? "inset 3px 0 0 var(--teal)" : selected ? "inset 0 0 0 2px var(--ink)" : undefined,
      }}
    >
      <td className={cn(cell, "w-12")} onClick={(e) => e.stopPropagation()}>
        <DoneToggle item={item} size={20} />
      </td>
      <td className={cn(cell, "font-semibold")}>
        <button type="button" onClick={onOpen} className="text-left">
          {item.title}
        </button>
        {hl ? (
          <span className="block text-[12px] font-medium text-teal-text">Just {hl === "added" ? "added" : "edited"}</span>
        ) : null}
      </td>
      <td className={cell}>
        <StatusPill status={item.status} />
      </td>
      <td className={cn(cell, item.priority === 2 && "font-semibold text-clay-ink")}>
        {item.priority !== null ? labels[item.priority] : "—"}
      </td>
      <td className={cell}>{item.price !== null ? money(item.price, item.currency ?? data.space.default_currency) : "—"}</td>
      <td className={cell}>{item.target_date ? targetDate(item.target_date) : item.status === "done" ? shortDate(item.done_at) : "—"}</td>
      <td className={cell}>
        {item.added_by ? <Avatar name={item.added_by} members={data.space.member_names} size={24} ring="none" /> : "—"}
      </td>
    </tr>
  );
}

function ItemTable({ items, selectedId, onOpen }: { items: Item[]; selectedId?: string; onOpen: (id: string) => void }) {
  return (
    <div className="hidden px-10 pt-4 lg:block">
      <table className="w-full border-collapse text-[14px]">
        <thead>
          <tr className="text-left text-[12px] tracking-[0.6px] text-ink-3 uppercase">
            <th className="w-12 px-2.5 py-2 font-semibold">
              <span className="sr-only">Done</span>
            </th>
            <th className="px-2.5 py-2 font-semibold">Title</th>
            <th className="px-2.5 py-2 font-semibold">Status</th>
            <th className="px-2.5 py-2 font-semibold">Priority</th>
            <th className="px-2.5 py-2 font-semibold">Budget</th>
            <th className="px-2.5 py-2 font-semibold">Date</th>
            <th className="px-2.5 py-2 font-semibold">By</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <TableRow key={item.id} item={item} selected={selectedId === item.id} onOpen={() => onOpen(item.id)} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
