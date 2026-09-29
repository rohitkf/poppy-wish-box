"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";

export interface Route {
  list?: string;
  item?: string;
  view?: "settings";
}

/**
 * The whole app is one document (so it works offline after one visit);
 * views live in the query string and change via history.pushState.
 */
export function useNav() {
  const params = useSearchParams();
  const route: Route = useMemo(
    () => ({
      list: params.get("list") ?? undefined,
      item: params.get("item") ?? undefined,
      view: params.get("view") === "settings" ? "settings" : undefined,
    }),
    [params],
  );

  const go = useCallback((next: Route, opts: { replace?: boolean } = {}) => {
    const q = new URLSearchParams();
    if (next.view) q.set("view", next.view);
    if (next.list) q.set("list", next.list);
    if (next.item) q.set("item", next.item);
    const url = q.size ? `/?${q}` : "/";
    if (opts.replace) window.history.replaceState(null, "", url);
    else window.history.pushState(null, "", url);
  }, []);

  return { route, go };
}
