"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/icons";
import { useSpace } from "@/components/app/SpaceProvider";
import { usePantry } from "@/components/app/Pantry";
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

/** Morning reminders on this phone (Web Push). */
function Reminders() {
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
    off: "Get a notification each morning when something is close to its date or past it.",
    on: "On for this device. You'll get a note each morning when something needs using up.",
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

export function PantrySettings() {
  const { actions } = useSpace();
  const { locations, warnDays, items } = usePantry();
  const [newLoc, setNewLoc] = useState("");

  const addLocation = () => {
    const l = newLoc.trim();
    if (!l || locations.some((x) => x.toLowerCase() === l.toLowerCase())) return setNewLoc("");
    actions.updateSpace({ pantry_locations: [...locations, l] });
    setNewLoc("");
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[15px] font-semibold">Warn me</div>
          <p className="text-[13px] text-ink-3">
            {warnDays === 0 ? "Amber on the day itself, red once it's past." : `Amber when ${warnDays} day${warnDays === 1 ? "" : "s"} or fewer are left, red once it's past.`}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1 rounded-xl bg-sunken p-1">
          <button
            type="button"
            aria-label="Warn one day later"
            disabled={warnDays <= 0}
            onClick={() => actions.updateSpace({ expiry_warn_days: warnDays - 1 })}
            className="h-9 w-9 rounded-[9px] text-[18px] disabled:opacity-40"
          >
            −
          </button>
          <span className="w-16 text-center text-[15px] font-semibold tabular-nums">
            {warnDays} day{warnDays === 1 ? "" : "s"}
          </span>
          <button
            type="button"
            aria-label="Warn one day earlier"
            disabled={warnDays >= 30}
            onClick={() => actions.updateSpace({ expiry_warn_days: warnDays + 1 })}
            className="h-9 w-9 rounded-[9px] text-[18px] disabled:opacity-40"
          >
            +
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="text-[15px] font-semibold">Places</div>
        <ul className="flex flex-wrap gap-2">
          {locations.map((l) => {
            const used = items.filter((i) => i.location === l).length;
            return (
              <li key={l} className="flex h-9 items-center gap-1 rounded-full border border-line-2 pr-1 pl-3.5 text-[14px]">
                {l}
                {used ? <span className="text-ink-3">· {used}</span> : null}
                <button
                  type="button"
                  aria-label={`Remove ${l}`}
                  disabled={locations.length <= 1}
                  onClick={() => actions.updateSpace({ pantry_locations: locations.filter((x) => x !== l) })}
                  className="flex h-7 w-7 items-center justify-center rounded-full text-ink-3 hover:bg-sunken disabled:opacity-30"
                >
                  <Icon.Close size={14} />
                </button>
              </li>
            );
          })}
        </ul>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            addLocation();
          }}
          className="flex gap-2"
        >
          <input
            value={newLoc}
            onChange={(e) => setNewLoc(e.target.value)}
            placeholder="Add a place, e.g. Garage fridge"
            maxLength={40}
            aria-label="New place"
            className="h-11 min-w-0 flex-1 rounded-xl border border-line-2 bg-bg px-3 text-[15px] outline-none focus:border-ink"
          />
          <button type="submit" disabled={!newLoc.trim()} className="h-11 rounded-xl bg-ink px-4 text-[14px] font-semibold text-bg disabled:opacity-40">
            Add
          </button>
        </form>
        <p className="text-[13px] text-ink-3">Removing a place keeps the items in it; they just stop showing it as a choice.</p>
      </div>

      <div className="border-t border-line-soft pt-4">
        <Reminders />
      </div>
    </div>
  );
}
