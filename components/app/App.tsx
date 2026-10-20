"use client";

import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Icon } from "@/components/icons";
import { Logo } from "@/components/ui/bits";
import { Toaster } from "@/components/ui/toaster";
import { SpaceProvider, useSpace } from "@/components/app/SpaceProvider";
import { Sidebar } from "@/components/app/Sidebar";
import { Home } from "@/components/app/Home";
import { ListView } from "@/components/app/ListView";
import { ItemDetail } from "@/components/app/ItemDetail";
import { Settings } from "@/components/app/Settings";
import { NamePicker } from "@/components/app/NamePicker";
import { UpdatePrompt } from "@/components/app/UpdatePrompt";
import { makeQueryClient, useOutboxSize } from "@/lib/client/store";
import { useNav } from "@/lib/client/nav";

const noopPersister = {
  persistClient: async () => {},
  restoreClient: async () => undefined,
  removeClient: async () => {},
};

function useIsDesktop() {
  return useSyncExternalStore(
    (cb) => {
      const mq = matchMedia("(min-width: 1024px)");
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => matchMedia("(min-width: 1024px)").matches,
    () => false,
  );
}

function Splash() {
  return (
    <div className="flex min-h-dvh items-center justify-center" aria-busy="true">
      <div className="flex animate-pulse flex-col items-center gap-3">
        <Logo size={64} />
        <span className="font-display text-[28px] font-semibold">Ours</span>
      </div>
    </div>
  );
}

function ErrorScreen({ retry }: { retry: () => void }) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-[360px] flex-col items-center justify-center gap-4 px-6 text-center">
      <Icon.CloudOff size={36} className="text-ink-3" />
      <h1 className="font-display text-[26px] font-semibold">Can’t reach your lists</h1>
      <p className="text-[15px] text-ink-2">Check your connection and try again.</p>
      <button type="button" onClick={retry} className="h-12 rounded-[14px] bg-clay px-6 text-[16px] font-semibold text-on-clay">
        Try again
      </button>
    </div>
  );
}

function SyncBanner() {
  const { online, live } = useSpace();
  const queued = useOutboxSize();
  let text: string | null = null;
  if (!online) text = queued ? `Offline · ${queued} change${queued === 1 ? "" : "s"} will sync` : "Offline · showing saved lists";
  else if (queued) text = `Syncing ${queued} change${queued === 1 ? "" : "s"}…`;
  else if (!live) text = null;
  return (
    <AnimatePresence>
      {text ? (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          role="status"
          className="pointer-events-none fixed top-2 left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 rounded-full bg-bar px-3.5 py-2 text-[13px] font-medium text-bar-ink shadow-float safe-top"
        >
          <Icon.CloudOff size={15} />
          {text}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function Shell() {
  const { data, me } = useSpace();
  const { route, go } = useNav();
  const desktop = useIsDesktop();

  const list = route.list ? data.lists.find((l) => l.id === route.list) : undefined;
  const item = route.item ? data.items.find((i) => i.id === route.item) : undefined;

  // The other person deleted what we're looking at: step back gracefully.
  useEffect(() => {
    if (route.list && !list) go({}, { replace: true });
    else if (route.item && !item) go({ list: route.list }, { replace: true });
  }, [route.list, route.item, list, item, go]);

  // An item moved to another list: follow it.
  useEffect(() => {
    if (item && list && item.list_id !== list.id) go({ list: item.list_id, item: item.id }, { replace: true });
  }, [item, list, go]);

  useEffect(() => {
    if (!desktop || !item) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.querySelector("[role=dialog]")) go({ list: route.list });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [desktop, item, route.list, go]);

  useEffect(() => {
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  if (!me) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-[440px] flex-col justify-center px-6 py-10">
        <NamePicker />
      </div>
    );
  }

  const closeItem = () => go({ list: route.list });
  let main: React.ReactNode;
  if (route.view === "settings") main = <Settings />;
  else if (list) main = <ListView key={list.id} list={list} />;
  else main = <Home />;

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[260px_minmax(0,1fr)]">
      <Sidebar />
      <div className={item && desktop && list ? "lg:grid lg:grid-cols-[minmax(0,1fr)_400px]" : undefined}>
        <main className="min-h-dvh min-w-0">{main}</main>
        {desktop && item && list ? (
          <section aria-label="Item detail" className="sticky top-0 h-dvh overflow-y-auto border-l border-line-strong">
            <ItemDetail key={item.id} item={item} onClose={closeItem} variant="panel" />
          </section>
        ) : null}
      </div>
      <AnimatePresence>
        {!desktop && item && list ? (
          <motion.section
            key="item"
            aria-label="Item detail"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 32, stiffness: 320 }}
            className="fixed inset-0 z-40 overflow-y-auto bg-bg"
          >
            <ItemDetail key={item.id} item={item} onClose={closeItem} variant="page" />
          </motion.section>
        ) : null}
      </AnimatePresence>
      <SyncBanner />
    </div>
  );
}

export function App() {
  const [qc] = useState(makeQueryClient);
  const [persister] = useState(() =>
    typeof window === "undefined"
      ? noopPersister
      : createSyncStoragePersister({ storage: window.localStorage, key: "ours:cache", throttleTime: 1000 }),
  );
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  if (!mounted) return <Splash />;

  return (
    <PersistQueryClientProvider client={qc} persistOptions={{ persister, maxAge: 1000 * 60 * 60 * 24 * 14, buster: "v1" }}>
      <SpaceProvider loading={<Splash />} error={(retry) => <ErrorScreen retry={retry} />}>
        <Shell />
        <UpdatePrompt />
      </SpaceProvider>
      <Toaster />
    </PersistQueryClientProvider>
  );
}
