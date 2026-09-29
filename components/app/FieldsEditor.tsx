"use client";

import { useState } from "react";
import { Icon } from "@/components/icons";
import { Sheet } from "@/components/ui/sheet";
import { useSpace } from "@/components/app/SpaceProvider";
import type { FieldDef, FieldType, List } from "@/lib/types";

export const FIELD_TYPES: { value: FieldType; label: string }[] = [
  { value: "text", label: "Text" },
  { value: "number", label: "Number" },
  { value: "date", label: "Date" },
  { value: "link", label: "Link" },
  { value: "select", label: "Choice" },
  { value: "checkbox", label: "Checkbox" },
];

function parseOptions(s: string) {
  return [...new Set(s.split(",").map((x) => x.trim()).filter(Boolean))].slice(0, 30);
}

function FieldRow({ field, first, last }: { field: FieldDef; first: boolean; last: boolean }) {
  const { data, actions } = useSpace();
  const [label, setLabel] = useState(field.label);
  const [options, setOptions] = useState(field.options.join(", "));
  const siblings = data.fields.filter((f) => f.list_id === field.list_id).sort((a, b) => a.position - b.position);
  const idx = siblings.findIndex((f) => f.id === field.id);

  const move = (dir: -1 | 1) => {
    const other = siblings[idx + dir];
    if (!other) return;
    actions.updateField(field.id, { position: other.position });
    actions.updateField(other.id, { position: field.position });
  };

  return (
    <li className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-3">
      <div className="flex items-center gap-2">
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onBlur={() => label.trim() && label.trim() !== field.label && actions.updateField(field.id, { label: label.trim() })}
          aria-label="Field name"
          maxLength={60}
          className="h-10 min-w-0 flex-1 rounded-lg bg-transparent px-1 text-[15px] font-semibold outline-none focus:bg-sunken"
        />
        <select
          value={field.type}
          onChange={(e) => actions.updateField(field.id, { type: e.target.value as FieldType })}
          aria-label="Field type"
          className="h-10 rounded-lg border border-line-2 bg-surface px-2 text-[14px]"
        >
          {FIELD_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        <div className="flex">
          <button type="button" disabled={first} onClick={() => move(-1)} aria-label="Move up" className="flex h-10 w-8 items-center justify-center rounded-lg text-ink-2 disabled:opacity-30">
            <Icon.Chevron size={16} className="rotate-180" />
          </button>
          <button type="button" disabled={last} onClick={() => move(1)} aria-label="Move down" className="flex h-10 w-8 items-center justify-center rounded-lg text-ink-2 disabled:opacity-30">
            <Icon.Chevron size={16} />
          </button>
        </div>
        <button
          type="button"
          onClick={() => actions.deleteField(field.id)}
          aria-label={`Delete field ${field.label}`}
          className="flex h-10 w-10 items-center justify-center rounded-lg text-danger hover:bg-sunken"
        >
          <Icon.Trash size={18} />
        </button>
      </div>
      {field.type === "select" ? (
        <input
          value={options}
          onChange={(e) => setOptions(e.target.value)}
          onBlur={() => actions.updateField(field.id, { options: parseOptions(options) })}
          placeholder="Choices, separated by commas"
          aria-label="Choices"
          className="h-10 rounded-lg border border-line-2 bg-bg px-3 text-[14px] outline-none"
        />
      ) : null}
    </li>
  );
}

export function FieldsEditor({ open, onOpenChange, list }: { open: boolean; onOpenChange: (v: boolean) => void; list: List }) {
  const { data, actions } = useSpace();
  const [label, setLabel] = useState("");
  const [type, setType] = useState<FieldType>("text");
  const [options, setOptions] = useState("");
  const fields = data.fields.filter((f) => f.list_id === list.id).sort((a, b) => a.position - b.position);

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim()) return;
    actions.createField(list.id, { label, type, options: type === "select" ? parseOptions(options) : [] });
    setLabel("");
    setOptions("");
  };

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="Fields for this list"
      description={`Extra details for every item in ${list.name}.`}
      wide
    >
      {fields.length ? (
        <ul className="flex flex-col gap-2 pt-1">
          {fields.map((f, i) => (
            <FieldRow key={f.id} field={f} first={i === 0} last={i === fields.length - 1} />
          ))}
        </ul>
      ) : (
        <p className="pt-1 text-[14px] text-ink-3">No custom fields yet. Try “Best season” (choice) or “Booked” (checkbox).</p>
      )}

      <form onSubmit={add} className="mt-5 flex flex-col gap-2.5 rounded-2xl bg-sunken p-3">
        <span className="text-[13px] font-semibold tracking-[0.6px] text-ink-3 uppercase">Add a field</span>
        <div className="flex gap-2">
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Field name"
            aria-label="New field name"
            maxLength={60}
            className="h-11 min-w-0 flex-1 rounded-xl border border-line-2 bg-surface px-3 text-[15px] outline-none"
          />
          <select
            value={type}
            onChange={(e) => setType(e.target.value as FieldType)}
            aria-label="New field type"
            className="h-11 rounded-xl border border-line-2 bg-surface px-2 text-[15px]"
          >
            {FIELD_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        {type === "select" ? (
          <input
            value={options}
            onChange={(e) => setOptions(e.target.value)}
            placeholder="Choices, e.g. Spring, Summer, Autumn"
            aria-label="Choices for new field"
            className="h-11 rounded-xl border border-line-2 bg-surface px-3 text-[15px] outline-none"
          />
        ) : null}
        <button type="submit" disabled={!label.trim()} className="h-11 rounded-xl bg-ink text-[15px] font-semibold text-bg disabled:opacity-40">
          Add field
        </button>
      </form>
    </Sheet>
  );
}
