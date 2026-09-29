"use client";

import { useState } from "react";
import { Avatar, Logo } from "@/components/ui/bits";
import { useSpace } from "@/components/app/SpaceProvider";

/** Asked once per device: who is using it (for “added by” and presence). */
export function NamePicker({ onDone }: { onDone?: () => void }) {
  const { data, me, setMe, actions } = useSpace();
  const members = data.space.member_names;
  const [name, setName] = useState("");

  const choose = (n: string) => {
    const clean = n.trim().slice(0, 40);
    if (!clean) return;
    if (!members.includes(clean)) actions.updateSpace({ member_names: [...members, clean].slice(-8) });
    setMe(clean);
    onDone?.();
  };

  return (
    <div className="flex flex-col gap-6">
      {!me ? (
        <div className="flex flex-col gap-3">
          <Logo size={52} />
          <h1 className="font-display text-[36px] leading-tight font-semibold tracking-[-0.5px]">Who’s this?</h1>
          <p className="text-[17px] leading-normal text-ink-2">
            Pick your name once on this device. It shows next to what you add, and lets the other person see you’re here.
          </p>
        </div>
      ) : null}
      {members.length ? (
        <div className="flex flex-col gap-2.5">
          {members.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => choose(n)}
              className="flex h-14 items-center gap-3 rounded-2xl border border-line bg-surface px-4 text-left text-[17px] font-semibold hover:border-ink"
              aria-pressed={me === n}
            >
              <Avatar name={n} members={members} ring="none" />
              I’m {n}
            </button>
          ))}
        </div>
      ) : null}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          choose(name);
        }}
        className="flex flex-col gap-2.5"
      >
        <label htmlFor="my-name" className="text-[14px] font-semibold">
          {members.length ? "Someone else" : "Your name"}
        </label>
        <input
          id="my-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Rohit"
          maxLength={40}
          autoComplete="given-name"
          className="h-14 rounded-[14px] border-[1.5px] border-ink bg-surface px-4 text-[18px] outline-none"
        />
        <button type="submit" disabled={!name.trim()} className="h-14 rounded-[14px] bg-clay text-[17px] font-semibold text-on-clay disabled:opacity-50">
          Continue
        </button>
      </form>
    </div>
  );
}
