"use client";

import * as DM from "@radix-ui/react-dropdown-menu";
import { Icon } from "@/components/icons";
import { cn } from "@/lib/client/util";

export const Menu = DM.Root;
export const MenuTrigger = DM.Trigger;

export function MenuContent({ children, align = "end" }: { children: React.ReactNode; align?: "start" | "end" | "center" }) {
  return (
    <DM.Portal>
      <DM.Content
        align={align}
        sideOffset={6}
        collisionPadding={12}
        className="z-50 min-w-[200px] max-h-[min(70dvh,420px)] overflow-y-auto rounded-2xl border border-line bg-surface p-1.5 text-ink shadow-float data-[state=open]:animate-[fade_120ms_ease-out]"
      >
        {children}
      </DM.Content>
    </DM.Portal>
  );
}

export function MenuItem({
  children,
  onSelect,
  danger,
  checked,
  icon,
}: {
  children: React.ReactNode;
  onSelect: () => void;
  danger?: boolean;
  checked?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <DM.Item
      onSelect={onSelect}
      className={cn(
        "flex min-h-11 cursor-pointer select-none items-center gap-3 rounded-xl px-3 text-[15px] outline-none data-[highlighted]:bg-sunken",
        danger && "text-danger",
      )}
    >
      {icon ? <span className="flex w-5 justify-center text-ink-2">{icon}</span> : null}
      <span className="flex-1">{children}</span>
      {checked ? <Icon.Check size={16} className="text-teal-text" /> : null}
    </DM.Item>
  );
}

export function MenuLabel({ children }: { children: React.ReactNode }) {
  return <DM.Label className="px-3 pt-2 pb-1 text-[12px] font-semibold tracking-[0.6px] text-ink-3 uppercase">{children}</DM.Label>;
}

export function MenuSeparator() {
  return <DM.Separator className="my-1 h-px bg-line-soft" />;
}
