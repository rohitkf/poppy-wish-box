"use client";

import { Reorder, useDragControls } from "framer-motion";
import { useMemo, useState } from "react";
import { Icon, ListGlyph } from "@/components/icons";
import { Avatar, HereIndicator, Logo, tileStyle } from "@/components/ui/bits";
import { Menu, MenuContent, MenuItem, MenuLabel, MenuTrigger } from "@/components/ui/menu";
import { useSpace } from "@/components/app/SpaceProvider";
import { ListEditor } from "@/components/app/ListEditor";
import { ItemMeta } from "@/components/app/ItemRow";
import { searchItems } from "@/lib/client/items";
import { useNav } from "@/lib/client/nav";
import { useNow } from "@/lib/client/clock";
import { cn, storage } from "@/lib/client/util";
import { activityLine, relativeTime } from "@/lib/format";
import type { List } from "@/lib/types";

function ListCard({ list, reordering }: { list: List; reordering: boolean }) {
  const { data, me } = useSpace();
  const { go } = useNav();
  const controls = useDragControls();
  const now = useNow();
  const items = data.items.filter((i) => i.list_id === list.id);
  const openCount = items.filter((i) => i.status !== "done").length;
  const latest = items.reduce<(typeof items)[number] | null>((a, b) => (!a || b.updated_at > a.updated_at ? b : a), null);
  const recentByOther =
    latest && latest.updated_by && latest.updated_by !== me && now - new Date(latest.updated_at).getTime() < 3_600_000;
  const planned = items.filter((i) => i.status === "planned").length;
  const sub = latest
    ? `${activityLine(latest, me)} · ${relativeTime(latest.updated_at, now || undefined)}`
    : planned
      ? `${planned} planned`
      : "Nothing yet";

  const body = (
    <>
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl" style={tileStyle(list.color)}>
        <ListGlyph emoji={list.emoji} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-[3px] text-left">
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate text-[17px] font-semibold">{list.name}</span>
          <span className="text-[13px] text-ink-3">{openCount}</span>
        </div>
        <span className={cn("truncate text-[13px]", recentByOther ? "text-teal-text" : "text-ink-3")}>{sub}</span>
      </div>
    </>
  );

  return (
    <Reorder.Item value={list.id} dragListener={false} dragControls={controls} className="min-w-0 list-none">
      <div className="flex items-center gap-2">
        {reordering ? (
          <button
            type="button"
            aria-label={`Drag to reorder ${list.name}`}
            onPointerDown={(e) => controls.start(e)}
            className="flex h-11 w-8 shrink-0 cursor-grab touch-none items-center justify-center text-ink-3"
          >
            <Icon.Grip />
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => !reordering && go({ list: list.id })}
          className="flex min-w-0 flex-1 items-center gap-3.5 rounded-2xl border border-line bg-surface p-3.5 hover:border-line-2"
        >
          {body}
        </button>
      </div>
    </Reorder.Item>
  );
}

function QuickAdd({ lists }: { lists: List[] }) {
  const { actions } = useSpace();
  const [title, setTitle] = useState("");
  const [target, setTarget] = useState<string | null>(() => storage.get("ours:quick-list"));
  const list = lists.find((l) => l.id === target) ?? lists[0];
  if (!list) return null;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    actions.addItem(list.id, title);
    setTitle("");
  };

  return (
    <form
      onSubmit={submit}
      className="bar fixed right-5 bottom-7 left-5 z-30 mx-auto flex h-[60px] max-w-[560px] items-center gap-2 rounded-[18px] bg-bar pr-2 pl-[18px] shadow-float safe-bottom lg:static lg:mx-0 lg:mt-6 lg:max-w-none lg:shadow-none"
    >
      <label htmlFor="quick" className="sr-only">
        Quick add
      </label>
      <input
        id="quick"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Add an idea…"
        autoComplete="off"
        enterKeyHint="done"
        maxLength={300}
        className="min-w-0 flex-1 bg-transparent text-[17px] text-bar-ink outline-none"
      />
      <Menu>
        <MenuTrigger className="h-11 max-w-[42%] truncate rounded-xl bg-bar-chip px-3 text-[14px] font-medium text-bar-chip-ink">
          {list.name}
        </MenuTrigger>
        <MenuContent>
          <MenuLabel>Add to</MenuLabel>
          {lists.map((l) => (
            <MenuItem
              key={l.id}
              checked={l.id === list.id}
              icon={<ListGlyph emoji={l.emoji} size={18} />}
              onSelect={() => {
                setTarget(l.id);
                storage.set("ours:quick-list", l.id);
              }}
            >
              {l.name}
            </MenuItem>
          ))}
        </MenuContent>
      </Menu>
      <button type="submit" aria-label={`Add to ${list.name}`} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-clay text-on-clay">
        <Icon.Plus size={20} />
      </button>
    </form>
  );
}

export function Home() {
  const { data, here, me, actions } = useSpace();
  const { go } = useNav();
  const [q, setQ] = useState("");
  const [creating, setCreating] = useState(false);
  const [reordering, setReordering] = useState(false);
  const lists = useMemo(
    () => data.lists.filter((l) => !l.archived_at).sort((a, b) => a.position - b.position),
    [data.lists],
  );
  const [order, setOrder] = useState<string[] | null>(null);
  const ids = order ?? lists.map((l) => l.id);
  const results = useMemo(() => searchItems(data.items, q).slice(0, 50), [data.items, q]);
  const listById = new Map(data.lists.map((l) => [l.id, l]));
  const members = data.space.member_names;

  return (
    <div className="flex min-h-full flex-col pb-32 lg:mx-auto lg:w-full lg:max-w-[760px] lg:px-10 lg:pb-12">
      <header className="flex items-center justify-between px-5 pt-5 pb-2 safe-top lg:hidden">
        <div className="flex items-center gap-2">
          <Logo />
          <span className="font-display text-[22px] font-semibold">Ours</span>
        </div>
        <div className="flex items-center gap-2.5">
          <HereIndicator here={here} />
          <button type="button" onClick={() => go({ view: "settings" })} aria-label="Settings" className="flex">
            {(members.length ? members : me ? [me] : []).slice(0, 2).map((n, i) => (
              <Avatar key={n} name={n} members={members} className={i ? "-ml-2" : undefined} />
            ))}
            {!members.length && !me ? <Icon.Settings /> : null}
          </button>
        </div>
      </header>

      <div className="flex flex-col gap-4 px-5 pt-3 lg:px-0 lg:pt-10">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-[36px] font-semibold tracking-[-0.5px] lg:text-[38px]">Our lists</h1>
          {lists.length > 1 && !q ? (
            <button
              type="button"
              onClick={() => {
                if (reordering && order) actions.reorderLists(order);
                setOrder(null);
                setReordering((v) => !v);
              }}
              className={cn("h-10 rounded-[10px] px-3 text-[14px] font-medium", reordering ? "bg-ink text-bg" : "text-ink-2 hover:bg-sunken")}
            >
              {reordering ? "Done" : "Reorder"}
            </button>
          ) : null}
        </div>
        <label className="flex h-12 items-center gap-2.5 rounded-xl bg-sunken px-3.5 text-ink-2">
          <Icon.Search size={18} />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search everything"
            aria-label="Search all lists"
            className="min-w-0 flex-1 bg-transparent text-[16px] text-ink outline-none"
          />
        </label>
      </div>

      {q ? (
        <section className="px-3 pt-4 lg:px-0" aria-live="polite">
          <p className="px-2 pb-2 text-[13px] text-ink-3">
            {results.length ? `${results.length} match${results.length === 1 ? "" : "es"}` : "No matches"}
          </p>
          <ul className="flex flex-col gap-0.5">
            {results.map((item) => {
              const l = listById.get(item.list_id);
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => go({ list: item.list_id, item: item.id })}
                    className="flex w-full items-center gap-3 rounded-[14px] px-2 py-2.5 text-left hover:bg-surface"
                  >
                    {l ? (
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={tileStyle(l.color)}>
                        <ListGlyph emoji={l.emoji} size={16} />
                      </span>
                    ) : null}
                    <span className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className={cn("truncate text-[16px] font-semibold", item.status === "done" && "text-ink-3 line-through")}>{item.title}</span>
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-ink-3">
                        <span>{l?.name}</span>
                        <ItemMeta item={item} />
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ) : (
        <nav className="flex flex-col gap-2.5 px-5 pt-5 lg:px-0" aria-label="Lists">
          <Reorder.Group axis="y" values={ids} onReorder={setOrder} className="flex flex-col gap-2.5">
            {ids.map((id) => {
              const l = lists.find((x) => x.id === id);
              return l ? <ListCard key={id} list={l} reordering={reordering} /> : null;
            })}
          </Reorder.Group>
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="flex h-16 items-center gap-3.5 rounded-2xl border-[1.5px] border-dashed border-dash px-3.5 text-[16px] font-medium text-ink-2 hover:bg-sunken"
          >
            <Icon.Plus size={20} />
            New list
          </button>
        </nav>
      )}

      {lists.length ? <QuickAdd lists={lists} /> : null}
      <ListEditor open={creating} onOpenChange={setCreating} onCreated={(id) => go({ list: id })} />
    </div>
  );
}
