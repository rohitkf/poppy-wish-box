import type { Metadata } from "next";
import { appPin } from "@/lib/session";
import { UnlockForm } from "./UnlockForm";

export const metadata: Metadata = { title: "Unlock · Ours" };
// Reads APP_PIN at request time, so the form always knows the current code's length.
export const dynamic = "force-dynamic";

export default function UnlockPage() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[440px] flex-col px-6 pt-10 pb-8 safe-top">
      <div className="flex flex-1 flex-col justify-center gap-10">
        <div className="flex flex-col gap-4">
          <svg width="64" height="40" viewBox="0 0 64 40" fill="none" strokeWidth="3" aria-hidden="true">
            <circle cx="22" cy="20" r="16" stroke="var(--clay)" />
            <circle cx="42" cy="20" r="16" stroke="var(--teal-text)" />
          </svg>
          <h1 className="font-display text-[64px] leading-none font-semibold tracking-[-1.5px]">Ours</h1>
          <p className="max-w-[290px] text-[18px] leading-[1.45] text-ink-2">
            One list for the two of you. Places to go, things to buy, plans to make.
          </p>
        </div>
        <UnlockForm length={appPin()?.length ?? null} />
      </div>
      <div className="flex items-center gap-2 text-[13px] text-ink-3">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
          <rect x="5" y="11" width="14" height="10" rx="2" />
          <path d="M8 11V8a4 4 0 0 1 8 0v3" />
        </svg>
        <span>Private space. Only people with the code can see it.</span>
      </div>
    </div>
  );
}
