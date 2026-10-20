"use client";

import { useEffect, useState } from "react";
import { Icon, ListGlyph } from "@/components/icons";
import { Segmented, tileStyle } from "@/components/ui/bits";
import { Sheet } from "@/components/ui/sheet";
import { useSpace } from "@/components/app/SpaceProvider";
import { NamePicker } from "@/components/app/NamePicker";
import { useNav } from "@/lib/client/nav";
import { showToast } from "@/lib/client/toast";
import { storage } from "@/lib/client/util";

type Theme = "system" | "light" | "dark";

export function applyTheme(t: Theme) {
  const dark = t === "dark" || (t === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="px-1 text-[13px] font-semibold tracking-[0.6px] text-ink-3 uppercase">{title}</h2>
      <div className="rounded-2xl border border-line bg-surface p-4">{children}</div>
    </section>
  );
}

export function Settings() {
  const { data, me, actions } = useSpace();
  const { go } = useNav();
  const [theme, setTheme] = useState<Theme>(() => (storage.get("ours:theme") as Theme) || "system");
  const [draftLabels, setLabels] = useState<string[] | null>(null);
  const labels = draftLabels ?? data.space.priority_labels;
  const [changingName, setChangingName] = useState(false);
  const [installEvt, setInstallEvt] = useState<Event & { prompt?: () => void } | null>(null);
  const archived = data.lists.filter((l) => l.archived_at);

  useEffect(() => {
    const h = (e: Event) => {
      e.preventDefault();
      setInstallEvt(e);
    };
    window.addEventListener("beforeinstallprompt", h);
    return () => window.removeEventListener("beforeinstallprompt", h);
  }, []);
  useEffect(() => {
    if (theme !== "system") return;
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const h = () => applyTheme("system");
    mq.addEventListener("change", h);
    return () => mq.removeEventListener("change", h);
  }, [theme]);

  const lock = async () => {
    // Only the server can clear the cookie, so locking needs a connection.
    const res = await fetch("/api/lock", { method: "POST" }).catch(() => null);
    if (!res?.ok) {
      showToast({ message: "Connect to the internet to lock this device.", tone: "error" });
      return;
    }
    storage.set("ours:cache", null);
    window.location.replace("/unlock");
  };

  return (
    <div className="mx-auto flex w-full max-w-[640px] flex-col gap-6 px-5 pt-3 pb-16 safe-top lg:px-10 lg:pt-10">
      <header className="flex items-center gap-2 lg:hidden">
        <button type="button" onClick={() => go({})} aria-label="Back" className="-ml-3 flex h-11 w-11 items-center justify-center rounded-xl hover:bg-sunken">
          <Icon.Back />
        </button>
      </header>
      <h1 className="font-display text-[34px] font-semibold tracking-[-0.5px]">Settings</h1>

      <Section title="This device">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[15px] font-semibold">{me ? `You’re ${me}` : "No name yet"}</div>
            <div className="text-[13px] text-ink-3">Used for “added by” and “is here”.</div>
          </div>
          <button type="button" onClick={() => setChangingName(true)} className="h-10 rounded-[10px] border border-line-2 px-3.5 text-[14px] font-medium">
            Change
          </button>
        </div>
      </Section>

      <Section title="Appearance">
        <Segmented<Theme>
          label="Theme"
          value={theme}
          options={[
            { value: "system", label: "System" },
            { value: "light", label: "Light" },
            { value: "dark", label: "Dark" },
          ]}
          onChange={(v) => {
            if (!v) return;
            setTheme(v);
            storage.set("ours:theme", v);
            applyTheme(v);
          }}
        />
      </Section>

      <Section title="Shared settings">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <span className="text-[14px] font-semibold">Priority labels</span>
            <div className="grid grid-cols-3 gap-2">
              {labels.map((l, i) => (
                <input
                  key={i}
                  value={l}
                  aria-label={`Priority label ${i + 1}`}
                  maxLength={20}
                  onChange={(e) => setLabels(labels.map((x, j) => (j === i ? e.target.value : x)))}
                  onBlur={() => {
                    if (labels.every((x) => x.trim()) && labels.join() !== data.space.priority_labels.join())
                      actions.updateSpace({ priority_labels: labels.map((x) => x.trim()) });
                    setLabels(null);
                  }}
                  className="h-11 min-w-0 rounded-xl border border-line-2 bg-bg px-3 text-[15px] outline-none focus:border-ink"
                />
              ))}
            </div>
          </div>
          <label className="flex items-center justify-between gap-3">
            <span className="text-[14px] font-semibold">Default currency</span>
            <select
              value={data.space.default_currency}
              onChange={(e) => actions.updateSpace({ default_currency: e.target.value })}
              className="h-11 rounded-xl border border-line-2 bg-bg px-3 text-[15px]"
            >
              {["GBP", "EUR", "USD", "INR", "AUD", "CAD", "NZD", "CHF", "JPY", "SEK", "AED", "SGD"].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
        </div>
      </Section>

      <Section title="Archived lists">
        {archived.length ? (
          <ul className="flex flex-col gap-1">
            {archived.map((l) => (
              <li key={l.id} className="flex items-center gap-3 py-1">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg" style={tileStyle(l.color)}>
                  <ListGlyph emoji={l.emoji} size={16} />
                </span>
                <span className="flex-1 truncate text-[15px]">{l.name}</span>
                <button
                  type="button"
                  onClick={() => actions.updateList(l.id, { archived_at: null })}
                  className="h-10 rounded-[10px] px-3 text-[14px] font-semibold text-clay-ink hover:bg-sunken"
                >
                  Restore
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[14px] text-ink-3">Nothing archived.</p>
        )}
      </Section>

      <Section title="App">
        <div className="flex flex-col gap-3 text-[14px] text-ink-2">
          {installEvt?.prompt ? (
            <button type="button" onClick={() => installEvt.prompt?.()} className="h-11 rounded-xl bg-ink text-[15px] font-semibold text-bg">
              Install Ours on this device
            </button>
          ) : (
            <p>
              To install: on iPhone, tap Share then “Add to Home Screen”. On Android or desktop Chrome, use “Install app” in the
              browser menu.
            </p>
          )}
          <button
            type="button"
            onClick={lock}
            className="flex h-11 items-center justify-center gap-2 rounded-xl border border-danger-line text-[15px] font-medium text-danger"
          >
            <Icon.Lock size={18} /> Lock this device
          </button>
        </div>
      </Section>

      <Sheet open={changingName} onOpenChange={setChangingName} title="Who’s using this device?">
        <div className="pt-2">
          <NamePicker onDone={() => setChangingName(false)} />
        </div>
      </Sheet>
    </div>
  );
}
