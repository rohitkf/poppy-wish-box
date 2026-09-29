"use client";

import { useState } from "react";
import { Icon } from "@/components/icons";

export function UnlockForm() {
  const [pass, setPass] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pass || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passcode: pass }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok) {
        window.location.replace("/");
        return;
      }
      setError(body.error || "Something went wrong. Try again.");
    } catch {
      setError("You're offline. Connect to unlock.");
    }
    setBusy(false);
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <label htmlFor="pass" className="text-[14px] font-semibold">
        Passcode
      </label>
      <div className="flex h-14 items-center gap-2 rounded-[14px] border-[1.5px] border-ink bg-surface pr-2 pl-4">
        <input
          id="pass"
          type={show ? "text" : "password"}
          value={pass}
          onChange={(e) => setPass(e.target.value)}
          autoComplete="current-password"
          autoFocus
          aria-invalid={!!error}
          aria-describedby="pass-help"
          className="min-w-0 flex-1 bg-transparent text-[18px] tracking-[2px] outline-none"
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? "Hide passcode" : "Show passcode"}
          className="flex h-11 w-11 items-center justify-center rounded-[10px] text-ink-2 hover:bg-sunken"
        >
          {show ? <Icon.EyeOff /> : <Icon.Eye />}
        </button>
      </div>
      <button
        type="submit"
        disabled={busy || !pass}
        className="h-14 rounded-[14px] bg-clay text-[17px] font-semibold text-on-clay disabled:opacity-60"
      >
        {busy ? "Unlocking…" : "Unlock"}
      </button>
      <p id="pass-help" role={error ? "alert" : undefined} className={error ? "text-[14px] font-medium text-danger" : "text-[13px] text-ink-3"}>
        {error ?? "After 5 wrong tries, entry pauses for 15 minutes."}
      </p>
    </form>
  );
}
