"use client";

import { useQueryClient } from "@tanstack/react-query";
import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  applyChange,
  DATA_KEY,
  flushOutbox,
  flushPendingDeletes,
  useActions,
  useData,
  type Actions,
} from "@/lib/client/store";
import { deviceId as getDeviceId, storage } from "@/lib/client/util";
import { useNow } from "@/lib/client/clock";
import type { ChangeEvent, SpaceData } from "@/lib/types";

interface SpaceCtx {
  data: SpaceData;
  me: string | null;
  setMe: (name: string) => void;
  deviceId: string;
  /** Names of other people currently here. */
  here: string[];
  online: boolean;
  live: boolean;
  actions: Actions;
}

const Ctx = createContext<SpaceCtx | null>(null);

export function useSpace() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useSpace outside SpaceProvider");
  return v;
}

export function SpaceProvider({
  children,
  loading,
  error,
}: {
  children: React.ReactNode;
  loading: React.ReactNode;
  error: (retry: () => void) => React.ReactNode;
}) {
  const qc = useQueryClient();
  const query = useData();
  const [me, setMeState] = useState<string | null>(() => storage.get("ours:me"));
  const [deviceId] = useState(getDeviceId);
  const [online, setOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine));
  const [live, setLive] = useState(false);
  const now = useNow();
  const meRef = useRef(me);
  useEffect(() => {
    meRef.current = me;
  }, [me]);
  const actions = useActions(me);

  const setMe = (name: string) => {
    storage.set("ours:me", name);
    setMeState(name);
  };

  // Online/offline + replay queued edits.
  useEffect(() => {
    const up = () => {
      setOnline(true);
      flushOutbox(qc);
    };
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    flushOutbox(qc);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, [qc]);

  // Live sync over Server-Sent Events.
  useEffect(() => {
    let es: EventSource | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;
    let firstReady = true;
    let stopped = false;

    const connect = () => {
      if (stopped) return;
      es = new EventSource("/api/events");
      es.addEventListener("ready", () => {
        setLive(true);
        // Reconnected after a gap: refetch whatever we may have missed.
        if (!firstReady) qc.invalidateQueries({ queryKey: DATA_KEY });
        firstReady = false;
      });
      es.onmessage = (msg) => {
        try {
          applyChange(qc, JSON.parse(msg.data) as ChangeEvent, meRef.current, deviceId);
        } catch {
          /* ignore malformed */
        }
      };
      es.onerror = () => {
        setLive(false);
        if (es?.readyState === EventSource.CLOSED) {
          es.close();
          // Might be a lock-out (401) — a data fetch will redirect if so.
          retry = setTimeout(() => {
            qc.invalidateQueries({ queryKey: DATA_KEY });
            firstReady = false;
            connect();
          }, 3000);
        }
      };
    };
    connect();
    return () => {
      stopped = true;
      if (retry) clearTimeout(retry);
      es?.close();
    };
  }, [qc, deviceId]);

  // Presence heartbeat.
  useEffect(() => {
    if (!me) return;
    const beat = () => {
      if (document.visibilityState !== "visible") return;
      fetch("/api/presence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId, name: me }),
      }).catch(() => {});
    };
    const leave = () => {
      flushPendingDeletes();
      navigator.sendBeacon?.(
        "/api/presence",
        new Blob([JSON.stringify({ deviceId, leave: true })], { type: "application/json" }),
      );
    };
    const onVis = () => (document.visibilityState === "visible" ? beat() : leave());
    beat();
    const t = setInterval(beat, 30_000);
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pagehide", leave);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pagehide", leave);
    };
  }, [me, deviceId]);

  const here = useMemo(() => {
    const cutoff = now - 75_000;
    const names = (query.data?.presence ?? [])
      .filter((p) => p.device_id !== deviceId && new Date(p.last_seen).getTime() > cutoff && p.name !== me)
      .map((p) => p.name);
    return [...new Set(names)];
  }, [query.data?.presence, deviceId, me, now]);

  if (!query.data) {
    if (query.isError) return <>{error(() => query.refetch())}</>;
    return <>{loading}</>;
  }

  return (
    <Ctx.Provider value={{ data: query.data, me, setMe, deviceId, here, online, live, actions }}>
      {children}
    </Ctx.Provider>
  );
}
