import type { Item } from "@/lib/types";

export type SortKey = "newest" | "priority" | "date" | "price" | "title";
export const SORTS: { key: SortKey; label: string }[] = [
  { key: "newest", label: "Newest" },
  { key: "priority", label: "Priority" },
  { key: "date", label: "Target date" },
  { key: "price", label: "Price" },
  { key: "title", label: "A–Z" },
];

export interface Filters {
  status: "all" | "idea" | "planned";
  high: boolean;
  by: string | null;
}

export const NO_FILTERS: Filters = { status: "all", high: false, by: null };

export function filterItems(items: Item[], f: Filters) {
  return items.filter(
    (i) =>
      (f.status === "all" || i.status === f.status) &&
      (!f.high || i.priority === 2) &&
      (!f.by || i.added_by === f.by),
  );
}

const nullsLast = (a: number | null, b: number | null, dir: 1 | -1) => {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return (a - b) * dir;
};

export function sortItems(items: Item[], key: SortKey) {
  const byNewest = (a: Item, b: Item) => b.created_at.localeCompare(a.created_at);
  const arr = items.slice();
  switch (key) {
    case "priority":
      return arr.sort((a, b) => nullsLast(a.priority, b.priority, -1) || byNewest(a, b));
    case "date":
      return arr.sort(
        (a, b) =>
          nullsLast(
            a.target_date ? Date.parse(a.target_date) : null,
            b.target_date ? Date.parse(b.target_date) : null,
            1,
          ) || byNewest(a, b),
      );
    case "price":
      return arr.sort((a, b) => nullsLast(a.price, b.price, 1) || byNewest(a, b));
    case "title":
      return arr.sort((a, b) => a.title.localeCompare(b.title, "en-GB", { sensitivity: "base" }));
    default:
      return arr.sort(byNewest);
  }
}

export function searchItems(items: Item[], q: string) {
  const needle = q.trim().toLowerCase();
  if (!needle) return [];
  return items.filter((i) =>
    [i.title, i.notes, i.location, i.url, ...(i.tags ?? []), ...Object.values(i.custom ?? {}).map(String)]
      .filter(Boolean)
      .some((s) => String(s).toLowerCase().includes(needle)),
  );
}
