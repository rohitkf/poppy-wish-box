"use client";

import { useEffect, useState } from "react";
import { useSpace } from "@/components/app/SpaceProvider";
import { showToast } from "@/lib/client/toast";

function keyBytes(base64url: string) {
  const b64 = (base64url + "=".repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

const post = (body: object) =>
  fetch("/api/push", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(async (r) => {
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Something went wrong");
  });

type PushState = "loading" | "unsupported" | "needs-install" | "blocked" | "off" | "on";

/** Morning reminders on this phone (Web Push): pantry dates and calendar events. */
export function Reminders() {
  const { me, deviceId } = useSpace();
  const [state, setState] = useState<PushState>("loading");
  const [endpoint, setEndpoint] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
      const ios = /iP(hone|ad|od)/.test(navigator.userAgent);
      const standalone = matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone;
      if (!supported) return alive && setState(ios && !standalone ? "needs-install" : "unsupported");
      if (Notification.permission === "denied") return alive && setState("blocked");
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (!alive) return;
      setEndpoint(sub?.endpoint ?? null);
      setState(sub ? "on" : "off");
    })().catch(() => alive && setState("unsupported"));
    return () => {
      alive = false;
    };
  }, []);

  const turnOn = async () => {
    setBusy(true);
    try {
      if ((await Notification.requestPermission()) !== "granted") {
        setState("blocked");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const { publicKey } = await fetch("/api/push").then((r) => r.json());
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) });
      await post({ action: "subscribe", subscription: sub.toJSON(), deviceId, name: me });
      setEndpoint(sub.endpoint);
      setState("on");
      await post({ action: "test", endpoint: sub.endpoint }).catch(() => {});
      showToast({ message: "Reminders are on. A test notification is on its way." });
    } catch (e) {
      showToast({ message: `Couldn't turn reminders on: ${(e as Error).message}`, tone: "error" });
    } finally {
      setBusy(false);
    }
  };

  const turnOff = async () => {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      const ep = sub?.endpoint ?? endpoint;
      await sub?.unsubscribe();
      if (ep) await post({ action: "unsubscribe", endpoint: ep }).catch(() => {});
      setEndpoint(null);
      setState("off");
    } finally {
      setBusy(false);
    }
  };

  const test = async () => {
    if (!endpoint) return;
    setBusy(true);
    try {
      await post({ action: "test", endpoint });
      showToast({ message: "Test sent. It should arrive in a few seconds." });
    } catch (e) {
      showToast({ message: (e as Error).message, tone: "error" });
    } finally {
      setBusy(false);
    }
  };

  const note: Record<PushState, string> = {
    loading: "Checking this device…",
    unsupported: "This browser can't show notifications from web apps.",
    "needs-install": "On iPhone, add Ours to your Home Screen first (Share, then “Add to Home Screen”), open it from there, then turn this on.",
    blocked: "Notifications are blocked for Ours. Allow them in this device's settings, then come back here.",
    off: "Get a notification in the morning when pantry food is close to its date, and for calendar events you ask to be reminded of.",
    on: "On for this device. Pantry food near its date and calendar reminders arrive around 7am.",
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[15px] font-semibold">Morning reminders on this device</div>
          <p className="text-[13px] text-ink-3">{note[state]}</p>
        </div>
        {state === "on" || state === "off" ? (
          <button
            type="button"
            role="switch"
            aria-checked={state === "on"}
            aria-label="Morning reminders on this device"
            disabled={busy}
            onClick={state === "on" ? turnOff : turnOn}
            className={`relative h-8 w-[52px] shrink-0 rounded-full transition-colors disabled:opacity-60 ${state === "on" ? "bg-teal" : "bg-line-2"}`}
          >
            <span className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-[left] ${state === "on" ? "left-[24px]" : "left-1"}`} />
          </button>
        ) : null}
      </div>
      {state === "on" ? (
        <button type="button" disabled={busy} onClick={test} className="self-start text-[14px] font-semibold text-clay-ink disabled:opacity-60">
          Send a test notification
        </button>
      ) : null}
    </div>
  );
}
