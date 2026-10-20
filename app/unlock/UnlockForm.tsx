"use client";

import { useState } from "react";
import { Icon } from "@/components/icons";

/** Numeric code entry. With `length` known, it submits as soon as the last digit is typed. */
export function UnlockForm({ length: initialLength }: { length: number | null }) {
  // Kept fresh from each reply, in case the code changed while this page was open.
  const [length, setLength] = useState(initialLength);
  const [code, setCode] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const unlock = async (value: string) => {
    if (!value || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: value }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok) {
        window.location.replace("/");
        return;
      }
      if (typeof body.length === "number") setLength(body.length);
      setError(body.error || "Something went wrong. Try again.");
      setCode("");
    } catch {
      setError("You're offline. Connect to unlock.");
    }
    setBusy(false);
  };

  const onChange = (raw: string) => {
    if (busy) return;
    const next = raw.replace(/\D/g, "").slice(0, length ?? 12);
    setCode(next);
    if (length && next.length === length) unlock(next);
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        unlock(code);
      }}
      className="flex flex-col gap-3"
    >
      <label htmlFor="code" className="text-[14px] font-semibold">
        Code
      </label>
      <div className="flex h-16 items-center gap-2 rounded-[14px] border-[1.5px] border-ink bg-surface pr-2 pl-4">
        <input
          id="code"
          type={show ? "text" : "password"}
          inputMode="numeric"
          pattern="[0-9]*"
          value={code}
          onChange={(e) => onChange(e.target.value)}
          autoComplete="current-password"
          autoFocus
          aria-invalid={!!error}
          aria-describedby="code-help"
          className="min-w-0 flex-1 bg-transparent text-[26px] font-semibold tracking-[0.4em] tabular-nums outline-none"
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? "Hide code" : "Show code"}
          className="flex h-11 w-11 items-center justify-center rounded-[10px] text-ink-2 hover:bg-sunken"
        >
          {show ? <Icon.EyeOff /> : <Icon.Eye />}
        </button>
      </div>
      <button
        type="submit"
        disabled={busy || !code}
        className="h-14 rounded-[14px] bg-clay text-[17px] font-semibold text-on-clay disabled:opacity-60"
      >
        {busy ? "Unlocking…" : "Unlock"}
      </button>
      <p id="code-help" role={error ? "alert" : undefined} className={error ? "text-[14px] font-medium text-danger" : "text-[13px] text-ink-3"}>
        {error ?? "After 5 wrong tries, entry pauses for 15 minutes."}
      </p>
    </form>
  );
}
