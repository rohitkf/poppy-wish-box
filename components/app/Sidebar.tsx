"use client";

import { useState } from "react";
import { Icon, ListGlyph } from "@/components/icons";
import { Avatar, Logo, tileStyle } from "@/components/ui/bits";
import { useSpace } from "@/components/app/SpaceProvider";
import { ListEditor } from "@/components/app/ListEditor";
import { useNav } from "@/lib/client/nav";
import { cn } from "@/lib/client/util";

export function Sidebar() {
  const { data, me, here } = useSpace();
  const { route, go } = useNav();
  const [creating, setCreating] = useState(false);
  const lists = data.lists.filter((l) => !l.archived_at).sort((a, b) => a.position - b.position);
  const members = data.space.member_names;

  return (
    <aside className="sticky top-0 hidden h-dvh flex-col gap-5 border-r border-line-strong bg-sidebar px-4 py-6 lg:flex">
      <button type="button" onClick={() => go({})} className="flex items-center gap-2 px-2" aria-label="Our lists">
        <Logo />
        <span className="font-display text-[24px] font-semibold">Ours</span>
      </button>
      <button
        type="button"
        onClick={() => go({})}
        className="flex h-10 items-center gap-2 rounded-[10px] border border-line-strong bg-surface px-3 text-[14px] text-ink-3"
      >
        <Icon.Search size={16} />
        Search
      </button>
      <nav className="-mx-1 flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-1" aria-label="Lists">
        {lists.map((l) => {
          const n = data.items.filter((i) => i.list_id === l.id && i.status !== "done").length;
          const active = route.list === l.id && !route.view;
          return (
            <button
              key={l.id}
              type="button"
              onClick={() => go({ list: l.id })}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex h-10 shrink-0 items-center gap-2.5 rounded-[10px] px-2.5 text-left text-[15px]",
                active ? "bg-surface font-semibold" : "hover:bg-surface/60",
              )}
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-md" style={tileStyle(l.color)}>
                <ListGlyph emoji={l.emoji} size={14} />
              </span>
              <span className="flex-1 truncate">{l.name}</span>
              <span className="text-[13px] font-normal text-ink-3">{n}</span>
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="flex h-10 shrink-0 items-center gap-2.5 rounded-[10px] px-2.5 text-[15px] text-ink-2 hover:bg-surface/60"
        >
          <Icon.Plus size={16} />
          New list
        </button>
      </nav>
      <button
        type="button"
        onClick={() => go({ view: "settings" })}
        className={cn(
          "flex items-center gap-2.5 rounded-xl border-t border-line-strong px-2.5 pt-3 pb-1 text-left",
          route.view === "settings" && "font-semibold",
        )}
      >
        <span className="flex">
          {(members.length ? members : me ? [me] : ["?"]).slice(0, 2).map((n, i) => (
            <Avatar key={n} name={n} members={members} size={30} ring="var(--sidebar)" className={i ? "-ml-2" : undefined} />
          ))}
        </span>
        <span className="flex min-w-0 flex-1 flex-col text-[13px]">
          <span className="truncate font-semibold">{me ? `You’re ${me}` : "Settings"}</span>
          {here.length ? (
            <span className="flex items-center gap-1.5 text-teal-text">
              <span className="h-[7px] w-[7px] rounded-full bg-online" />
              {here[0]} is here
            </span>
          ) : (
            <span className="text-ink-3">Settings</span>
          )}
        </span>
        <Icon.Settings size={18} className="text-ink-3" />
      </button>
      <ListEditor open={creating} onOpenChange={setCreating} onCreated={(id) => go({ list: id })} />
    </aside>
  );
}
