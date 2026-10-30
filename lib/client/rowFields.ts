"use client";

import { useState } from "react";
import { storage } from "@/lib/client/util";

/** Details an item row (and the desktop table) can show. Custom fields are `custom:<key>`. */
export type RowField = "status" | "priority" | "who" | "price" | "date" | "location" | "link" | "tags" | "notes" | "added" | `custom:${string}`;

export const BUILTIN_ROW_FIELDS: { key: RowField; label: string; short?: string }[] = [
  { key: "status", label: "Status" },
  { key: "priority", label: "Priority" },
  { key: "who", label: "Who wants it", short: "For" },
  { key: "price", label: "Budget" },
  { key: "date", label: "Target date", short: "Date" },
  { key: "location", label: "Location" },
  { key: "link", label: "Link" },
  { key: "tags", label: "Tags" },
  { key: "notes", label: "Notes" },
  { key: "added", label: "Added by", short: "By" },
];

/** What rows showed before the picker existed. */
export const DEFAULT_ROW_FIELDS: RowField[] = ["status", "priority", "price", "date", "link", "added"];

function load(listId: string): RowField[] {
  try {
    const saved = JSON.parse(storage.get(`ours:fields:${listId}`) || "null");
    return Array.isArray(saved) && saved.every((f) => typeof f === "string") ? (saved as RowField[]) : DEFAULT_ROW_FIELDS;
  } catch {
    return DEFAULT_ROW_FIELDS;
  }
}

/** The details this device shows on a list's items. Remembered per list, like the sort order. */
export function useRowFields(listId: string) {
  const [fields, setFields] = useState<RowField[]>(() => load(listId));
  const save = (next: RowField[]) => {
    setFields(next);
    storage.set(`ours:fields:${listId}`, JSON.stringify(next));
  };
  return {
    fields,
    toggle: (f: RowField) => save(fields.includes(f) ? fields.filter((x) => x !== f) : [...fields, f]),
    reset: () => save(DEFAULT_ROW_FIELDS),
  };
}
