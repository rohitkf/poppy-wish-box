"use client";

import { QueryClient, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useSyncExternalStore } from "react";
import type {
  ChangeEvent,
  CustomValue,
  FieldDef,
  FieldDefPatch,
  FieldType,
  Item,
  ItemPatch,
  ItemPhoto,
  List,
  ListColor,
  ListPatch,
  Mutation,
  SpaceData,
  SpacePatch,
} from "@/lib/types";
import { showToast } from "@/lib/client/toast";
import { storage, uid } from "@/lib/client/util";

export const DATA_KEY = ["space-data"] as const;

// ─── HTTP ───────────────────────────────────────────────────────────────────

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

const isNetworkError = (e: unknown) => e instanceof TypeError;

function goToUnlock() {
  if (typeof window !== "undefined" && window.location.pathname !== "/unlock") window.location.replace("/unlock");
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: init?.body instanceof FormData ? init?.headers : { "Content-Type": "application/json", ...init?.headers },
  });
  if (res.status === 401) {
    goToUnlock();
    throw new ApiError("Locked", 401);
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(body.error || "Something went wrong", res.status);
  return body as T;
}

export const fetchData = () => api<SpaceData>("/api/data");

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 1000 * 60 * 60 * 24 * 7,
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
        networkMode: "offlineFirst",
        retry: (count, e) => !(e instanceof ApiError && e.status === 401) && count < 2,
      },
    },
  });
}

// ─── Offline outbox ─────────────────────────────────────────────────────────
// Mutations that can't reach the server are kept (in order) and replayed when
// the device is back online, even across reloads.

const OUTBOX_KEY = "ours:outbox";
let outbox: Mutation[] = (() => {
  try {
    return JSON.parse(storage.get(OUTBOX_KEY) || "[]");
  } catch {
    return [];
  }
})();
const outboxListeners = new Set<() => void>();
function saveOutbox() {
  storage.set(OUTBOX_KEY, outbox.length ? JSON.stringify(outbox) : null);
  outboxListeners.forEach((l) => l());
}

export function useOutboxSize() {
  return useSyncExternalStore(
    (l) => {
      outboxListeners.add(l);
      return () => outboxListeners.delete(l);
    },
    () => outbox.length,
    () => 0,
  );
}

let flushing: Promise<void> | null = null;
export function flushOutbox(qc: QueryClient) {
  if (flushing || !outbox.length) return flushing ?? Promise.resolve();
  flushing = (async () => {
    try {
      while (outbox.length) {
        try {
          await api("/api/mutate", { method: "POST", body: JSON.stringify(outbox[0]) });
        } catch (e) {
          if (isNetworkError(e) || (e instanceof ApiError && e.status === 401)) return;
          showToast({ message: `A queued change couldn't be saved: ${(e as Error).message}`, tone: "error" });
        }
        outbox.shift();
        saveOutbox();
      }
      await qc.invalidateQueries({ queryKey: DATA_KEY });
    } finally {
      flushing = null;
    }
  })();
  return flushing;
}

async function send(m: Mutation): Promise<Record<string, unknown> | null> {
  if (outbox.length || (typeof navigator !== "undefined" && !navigator.onLine)) {
    outbox.push(m);
    saveOutbox();
    return null;
  }
  try {
    const res = await api<{ row: Record<string, unknown> | null }>("/api/mutate", {
      method: "POST",
      body: JSON.stringify(m),
      keepalive: true,
    });
    return res.row;
  } catch (e) {
    if (isNetworkError(e)) {
      outbox.push(m);
      saveOutbox();
      return null;
    }
    throw e;
  }
}

// ─── Highlights for changes made on the other device ────────────────────────

const highlights = new Map<string, "added" | "edited">();
const hlListeners = new Set<() => void>();
export function markHighlight(id: string, kind: "added" | "edited") {
  highlights.set(id, kind);
  hlListeners.forEach((l) => l());
  setTimeout(() => {
    if (highlights.get(id) === kind) {
      highlights.delete(id);
      hlListeners.forEach((l) => l());
    }
  }, 8000);
}
export function useHighlight(id: string) {
  return useSyncExternalStore(
    (l) => {
      hlListeners.add(l);
      return () => hlListeners.delete(l);
    },
    () => highlights.get(id) ?? null,
    () => null,
  );
}

// ─── Local photo previews (while uploading) ─────────────────────────────────

export const localPreviews = new Map<string, string>();

// ─── Cache helpers ──────────────────────────────────────────────────────────

type Collection = "lists" | "fields" | "items" | "photos";
const TABLE_TO_KEY: Record<string, Collection | "space" | "presence"> = {
  lists: "lists",
  field_defs: "fields",
  items: "items",
  item_photos: "photos",
  spaces: "space",
  presence: "presence",
};

/** Item fields edited locally and not yet confirmed; remote rows don't clobber them. */
const pendingFields = new Map<string, Map<string, number>>();
function addPending(id: string, fields: string[]) {
  let m = pendingFields.get(id);
  if (!m) pendingFields.set(id, (m = new Map()));
  for (const f of fields) m.set(f, (m.get(f) ?? 0) + 1);
}
function releasePending(id: string, fields: string[]) {
  const m = pendingFields.get(id);
  if (!m) return;
  for (const f of fields) {
    const n = (m.get(f) ?? 1) - 1;
    if (n <= 0) m.delete(f);
    else m.set(f, n);
  }
  if (!m.size) pendingFields.delete(id);
}

function upsert<T extends { id: string }>(arr: T[], row: T, preserve?: (prev: T, next: T) => T): T[] {
  const i = arr.findIndex((r) => r.id === row.id);
  if (i === -1) return [row, ...arr];
  const next = arr.slice();
  next[i] = preserve ? preserve(arr[i], row) : { ...arr[i], ...row };
  return next;
}

function preserveItem(prev: Item, next: Item): Item {
  const pend = pendingFields.get(prev.id);
  if (!pend) return next;
  const merged = { ...next } as Item & Record<string, unknown>;
  for (const f of pend.keys()) {
    if (f.startsWith("custom.")) {
      const k = f.slice(7);
      merged.custom = { ...merged.custom, [k]: prev.custom[k] };
      if (prev.custom[k] === undefined) delete merged.custom[k];
    } else {
      merged[f] = (prev as unknown as Record<string, unknown>)[f];
    }
  }
  return merged;
}

export function applyChange(qc: QueryClient, ev: ChangeEvent, me: string | null, myDevice: string) {
  const key = TABLE_TO_KEY[ev.table];
  if (!key) return;
  if (ev.refetch) {
    qc.invalidateQueries({ queryKey: DATA_KEY });
    return;
  }
  qc.setQueryData<SpaceData>(DATA_KEY, (d) => {
    if (!d) return d;
    if (key === "space") return ev.row ? { ...d, space: { ...d.space, ...(ev.row as object) } } : d;
    if (key === "presence") {
      const others = d.presence.filter((p) => p.device_id !== ev.id);
      if (ev.op === "DELETE" || ev.id === myDevice) return { ...d, presence: others };
      return { ...d, presence: [...others, ev.row as unknown as SpaceData["presence"][number]] };
    }
    if (ev.op === "DELETE") {
      const next = { ...d, [key]: (d[key] as { id: string }[]).filter((r) => r.id !== ev.id) };
      if (key === "items") next.photos = d.photos.filter((p) => p.item_id !== ev.id);
      if (key === "lists") {
        next.items = d.items.filter((i) => i.list_id !== ev.id);
        next.fields = d.fields.filter((f) => f.list_id !== ev.id);
      }
      return next;
    }
    const row = { ...(ev.row as Record<string, unknown>) };
    delete row.blob_url;
    if (key === "items") {
      const item = row as unknown as Item;
      // Deleted locally and waiting for undo? Ignore echoes.
      if (pendingDeletes.has(item.id)) return d;
      const who = ev.op === "INSERT" ? item.added_by : item.updated_by;
      if (who && who !== me) markHighlight(item.id, ev.op === "INSERT" ? "added" : "edited");
      return { ...d, items: upsert(d.items, item, preserveItem) };
    }
    return { ...d, [key]: upsert(d[key] as { id: string }[], row as { id: string }) };
  });
}

// ─── Actions ────────────────────────────────────────────────────────────────

const pendingDeletes = new Map<string, { timer: ReturnType<typeof setTimeout>; run: () => void }>();

/** Sends any delete still waiting for its undo window (used on page hide). */
export function flushPendingDeletes() {
  pendingDeletes.forEach((p) => {
    clearTimeout(p.timer);
    p.run();
  });
}

export function useData() {
  return useQuery({ queryKey: DATA_KEY, queryFn: fetchData });
}

export function useActions(me: string | null) {
  const qc = useQueryClient();

  const set = useCallback(
    (fn: (d: SpaceData) => SpaceData) => qc.setQueryData<SpaceData>(DATA_KEY, (d) => (d ? fn(d) : d)),
    [qc],
  );
  const get = useCallback(() => qc.getQueryData<SpaceData>(DATA_KEY), [qc]);

  const fail = useCallback(
    (e: unknown) => {
      if (e instanceof ApiError && e.status === 401) return;
      showToast({ message: `Couldn't save: ${(e as Error).message}. Change undone.`, tone: "error" });
      qc.invalidateQueries({ queryKey: DATA_KEY });
    },
    [qc],
  );

  const mergeRow = useCallback(
    (collection: Collection, row: Record<string, unknown> | null) => {
      if (!row) return;
      delete row.blob_url;
      set((d) => ({
        ...d,
        [collection]: upsert(
          d[collection] as { id: string }[],
          row as { id: string },
          collection === "items" ? (preserveItem as never) : undefined,
        ),
      }));
    },
    [set],
  );

  return useMemo(() => {
    const updateItem = (id: string, patch: ItemPatch) => {
      const now = new Date().toISOString();
      const fields = [
        ...Object.keys(patch).filter((k) => k !== "custom"),
        ...Object.keys(patch.custom ?? {}).map((k) => `custom.${k}`),
      ];
      set((d) => ({
        ...d,
        items: d.items.map((it) => {
          if (it.id !== id) return it;
          const next: Item = { ...it, ...patch, custom: it.custom, updated_at: now, updated_by: me ?? it.updated_by };
          if (patch.custom) {
            const custom = { ...it.custom };
            for (const [k, v] of Object.entries(patch.custom)) {
              if (v === null || v === "") delete custom[k];
              else custom[k] = v;
            }
            next.custom = custom;
          }
          if (patch.status) next.done_at = patch.status === "done" ? (it.done_at ?? now) : null;
          return next;
        }),
      }));
      addPending(id, fields);
      send({ op: "item.update", id, patch, actor: me })
        .then((row) => {
          releasePending(id, fields);
          mergeRow("items", row);
        })
        .catch((e) => {
          releasePending(id, fields);
          fail(e);
        });
    };

    return {
      addItem(listId: string, title: string, extra: Partial<Item> = {}) {
        const id = uid();
        const now = new Date().toISOString();
        const item: Item = {
          id,
          space_id: get()?.space.id ?? "",
          list_id: listId,
          title: title.trim(),
          notes: null,
          url: null,
          price: null,
          currency: null,
          priority: null,
          target_date: null,
          status: "idea",
          location: null,
          tags: [],
          who_wants: null,
          added_by: me,
          updated_by: me,
          position: Date.now() / 1000,
          custom: {},
          created_at: now,
          updated_at: now,
          done_at: null,
          ...extra,
        };
        set((d) => ({ ...d, items: [item, ...d.items] }));
        send({ op: "item.create", item: { id, list_id: listId, title: item.title, position: item.position }, actor: me })
          .then((row) => mergeRow("items", row))
          .catch(fail);
        return id;
      },

      updateItem,

      setCustom(id: string, key: string, value: CustomValue) {
        updateItem(id, { custom: { [key]: value } });
      },

      deleteItem(id: string) {
        const d = get();
        const item = d?.items.find((i) => i.id === id);
        if (!d || !item) return;
        const photos = d.photos.filter((p) => p.item_id === id);
        set((s) => ({ ...s, items: s.items.filter((i) => i.id !== id), photos: s.photos.filter((p) => p.item_id !== id) }));
        const run = () => {
          pendingDeletes.delete(id);
          send({ op: "item.delete", id }).catch(fail);
        };
        pendingDeletes.set(id, { timer: setTimeout(run, 5500), run });
        showToast(
          {
            message: `Deleted “${item.title}”`,
            action: {
              label: "Undo",
              onClick: () => {
                const p = pendingDeletes.get(id);
                if (!p) return;
                clearTimeout(p.timer);
                pendingDeletes.delete(id);
                set((s) => ({ ...s, items: [item, ...s.items], photos: [...s.photos, ...photos] }));
              },
            },
          },
          5000,
        );
      },

      createList(input: { name: string; emoji: string; color: ListColor }) {
        const d = get();
        const id = uid();
        const now = new Date().toISOString();
        const position = Math.max(0, ...(d?.lists.map((l) => l.position) ?? [0])) + 1;
        const list: List = {
          id,
          space_id: d?.space.id ?? "",
          name: input.name.trim(),
          emoji: input.emoji,
          color: input.color,
          position,
          archived_at: null,
          created_at: now,
          updated_at: now,
        };
        set((s) => ({ ...s, lists: [...s.lists, list] }));
        send({ op: "list.create", list: { id, name: list.name, emoji: list.emoji, color: list.color, position } })
          .then((row) => mergeRow("lists", row))
          .catch(fail);
        return id;
      },

      updateList(id: string, patch: ListPatch) {
        set((s) => ({
          ...s,
          lists: s.lists.map((l) =>
            l.id === id
              ? { ...l, ...patch, archived_at: "archived_at" in patch ? (patch.archived_at ? new Date().toISOString() : null) : l.archived_at }
              : l,
          ),
        }));
        send({ op: "list.update", id, patch })
          .then((row) => mergeRow("lists", row))
          .catch(fail);
      },

      reorderLists(orderedIds: string[]) {
        const order = orderedIds.map((id, i) => ({ id, position: i + 1 }));
        const pos = new Map(order.map((o) => [o.id, o.position]));
        set((s) => ({ ...s, lists: s.lists.map((l) => (pos.has(l.id) ? { ...l, position: pos.get(l.id)! } : l)) }));
        send({ op: "list.reorder", order }).catch(fail);
      },

      deleteList(id: string) {
        set((s) => ({
          ...s,
          lists: s.lists.filter((l) => l.id !== id),
          items: s.items.filter((i) => i.list_id !== id),
          fields: s.fields.filter((f) => f.list_id !== id),
        }));
        send({ op: "list.delete", id }).catch(fail);
      },

      createField(listId: string, input: { label: string; type: FieldType; options: string[] }) {
        const d = get();
        const id = uid();
        const position = Math.max(0, ...(d?.fields.filter((f) => f.list_id === listId).map((f) => f.position) ?? [0])) + 1;
        const field: FieldDef = {
          id,
          space_id: d?.space.id ?? "",
          list_id: listId,
          key: `pending_${id.slice(0, 4)}`,
          label: input.label.trim(),
          type: input.type,
          options: input.options,
          position,
        };
        set((s) => ({ ...s, fields: [...s.fields, field] }));
        send({ op: "field.create", field: { id, list_id: listId, label: field.label, type: field.type, options: field.options, position } })
          .then((row) => mergeRow("fields", row))
          .catch(fail);
      },

      updateField(id: string, patch: FieldDefPatch) {
        set((s) => ({ ...s, fields: s.fields.map((f) => (f.id === id ? { ...f, ...patch } : f)) }));
        send({ op: "field.update", id, patch })
          .then((row) => mergeRow("fields", row))
          .catch(fail);
      },

      deleteField(id: string) {
        set((s) => ({ ...s, fields: s.fields.filter((f) => f.id !== id) }));
        send({ op: "field.delete", id }).catch(fail);
      },

      updateSpace(patch: SpacePatch) {
        set((s) => ({ ...s, space: { ...s.space, ...patch } }));
        send({ op: "space.update", patch })
          .then((row) => row && set((s) => ({ ...s, space: { ...s.space, ...(row as object) } })))
          .catch(fail);
      },

      async uploadPhoto(itemId: string, file: File) {
        if (typeof navigator !== "undefined" && !navigator.onLine) {
          showToast({ message: "Photos need a connection. Try again when you're back online.", tone: "error" });
          return;
        }
        const id = uid();
        const { compressImage } = await import("@/lib/image");
        let compressed: Awaited<ReturnType<typeof compressImage>>;
        try {
          compressed = await compressImage(file);
        } catch (e) {
          showToast({ message: (e as Error).message, tone: "error" });
          return;
        }
        localPreviews.set(id, URL.createObjectURL(compressed.blob));
        const photo: ItemPhoto = {
          id,
          space_id: get()?.space.id ?? "",
          item_id: itemId,
          width: compressed.width,
          height: compressed.height,
          position: Date.now() / 1000,
          created_at: new Date().toISOString(),
        };
        set((s) => ({ ...s, photos: [...s.photos, photo] }));
        const form = new FormData();
        form.set("file", compressed.blob, "photo.jpg");
        form.set("id", id);
        form.set("itemId", itemId);
        form.set("width", String(compressed.width));
        form.set("height", String(compressed.height));
        try {
          const res = await api<{ row: ItemPhoto }>("/api/photos", { method: "POST", body: form });
          mergeRow("photos", res.row as unknown as Record<string, unknown>);
        } catch (e) {
          set((s) => ({ ...s, photos: s.photos.filter((p) => p.id !== id) }));
          if (!(e instanceof ApiError && e.status === 401)) {
            showToast({ message: `Photo not saved: ${(e as Error).message}`, tone: "error" });
          }
        }
      },

      deletePhoto(id: string) {
        set((s) => ({ ...s, photos: s.photos.filter((p) => p.id !== id) }));
        send({ op: "photo.delete", id }).catch(fail);
      },
    };
  }, [me, set, get, fail, mergeRow]);
}

export type Actions = ReturnType<typeof useActions>;
