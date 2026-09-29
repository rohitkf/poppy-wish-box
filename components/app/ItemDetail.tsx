"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useRef, useState } from "react";
import { Icon, ListGlyph } from "@/components/icons";
import { Segmented, tileStyle } from "@/components/ui/bits";
import { Menu, MenuContent, MenuItem, MenuLabel, MenuTrigger } from "@/components/ui/menu";
import { useSpace } from "@/components/app/SpaceProvider";
import { PhotoThumb, photoSrc } from "@/components/app/Photo";
import { FieldsEditor } from "@/components/app/FieldsEditor";
import { cn } from "@/lib/client/util";
import { domain, mapsLink, relativeTime, shortDate } from "@/lib/format";
import type { CustomValue, FieldDef, Item, ItemPhoto, Status } from "@/lib/types";

const CURRENCIES = ["GBP", "EUR", "USD", "INR", "AUD", "CAD", "NZD", "CHF", "JPY", "SEK", "AED", "SGD"];

/** Local draft that follows remote changes unless the field is being edited. */
function useDraft<T>(value: T) {
  const [draft, setDraft] = useState(value);
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setDraft(value);
  }, [value]);
  return {
    draft,
    setDraft,
    bind: {
      onFocus: () => (focused.current = true),
      onBlurCapture: () => (focused.current = false),
    },
  };
}

function Row({ label, children, htmlFor }: { label: string; children: React.ReactNode; htmlFor?: string }) {
  return (
    <div className="flex min-h-[52px] items-center justify-between gap-3 border-b border-line-soft py-1.5 last:border-b-0">
      <label htmlFor={htmlFor} className="shrink-0 text-[14px] text-ink-3">
        {label}
      </label>
      <div className="flex min-w-0 flex-1 items-center justify-end gap-2 text-right">{children}</div>
    </div>
  );
}

const inputCls =
  "min-w-0 w-full bg-transparent text-right text-[15px] font-medium outline-none placeholder:font-normal rounded-md px-1 py-1 focus:bg-sunken";

function TextField({
  id,
  value,
  onSave,
  placeholder,
  type = "text",
  inputMode,
}: {
  id: string;
  value: string;
  onSave: (v: string) => void;
  placeholder?: string;
  type?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
}) {
  const { draft, setDraft, bind } = useDraft(value);
  return (
    <input
      id={id}
      type={type}
      inputMode={inputMode}
      value={draft}
      placeholder={placeholder}
      onChange={(e) => setDraft(e.target.value)}
      {...bind}
      onBlur={() => draft !== value && onSave(draft)}
      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
      className={inputCls}
    />
  );
}

function TagsField({ item }: { item: Item }) {
  const { actions } = useSpace();
  const [text, setText] = useState("");
  const add = () => {
    const t = text.trim().replace(/,$/, "");
    if (t && !item.tags.includes(t)) actions.updateItem(item.id, { tags: [...item.tags, t] });
    setText("");
  };
  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5 py-1">
      {item.tags.map((t) => (
        <span key={t} className="flex items-center gap-1 rounded-lg bg-sunken py-1 pr-1 pl-2.5 text-[13px]">
          {t}
          <button
            type="button"
            aria-label={`Remove tag ${t}`}
            onClick={() => actions.updateItem(item.id, { tags: item.tags.filter((x) => x !== t) })}
            className="flex h-5 w-5 items-center justify-center rounded text-ink-3 hover:text-ink"
          >
            <Icon.Close size={12} />
          </button>
        </span>
      ))}
      <input
        id="f-tags"
        value={text}
        onChange={(e) => (e.target.value.endsWith(",") ? (setText(e.target.value), setTimeout(add)) : setText(e.target.value))}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            add();
          } else if (e.key === "Backspace" && !text && item.tags.length) {
            actions.updateItem(item.id, { tags: item.tags.slice(0, -1) });
          }
        }}
        onBlur={add}
        placeholder={item.tags.length ? "+" : "weekend, abroad…"}
        className="w-24 min-w-0 rounded-md bg-transparent px-1 py-1 text-right text-[14px] outline-none focus:bg-sunken"
      />
    </div>
  );
}

function CustomField({ item, field }: { item: Item; field: FieldDef }) {
  const { actions } = useSpace();
  const raw = item.custom?.[field.key];
  const save = (v: CustomValue) => actions.setCustom(item.id, field.key, v);
  const id = `cf-${field.id}`;

  switch (field.type) {
    case "checkbox":
      return (
        <Row label={field.label} htmlFor={id}>
          <input
            id={id}
            type="checkbox"
            checked={raw === true}
            onChange={(e) => save(e.target.checked || null)}
            className="h-[22px] w-[22px] accent-[var(--teal)]"
          />
        </Row>
      );
    case "select":
      return (
        <Row label={field.label} htmlFor={id}>
          <select
            id={id}
            value={typeof raw === "string" ? raw : ""}
            onChange={(e) => save(e.target.value || null)}
            className="max-w-[60%] rounded-md bg-transparent py-1 text-right text-[15px] font-medium outline-none focus:bg-sunken"
          >
            <option value="">—</option>
            {field.options.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
            {typeof raw === "string" && raw && !field.options.includes(raw) ? <option value={raw}>{raw}</option> : null}
          </select>
        </Row>
      );
    case "number":
      return (
        <Row label={field.label} htmlFor={id}>
          <TextField
            id={id}
            type="number"
            inputMode="decimal"
            value={raw === null || raw === undefined ? "" : String(raw)}
            onSave={(v) => save(v === "" || !Number.isFinite(Number(v)) ? null : Number(v))}
            placeholder="—"
          />
        </Row>
      );
    case "date":
      return (
        <Row label={field.label} htmlFor={id}>
          <input
            id={id}
            type="date"
            value={typeof raw === "string" ? raw : ""}
            onChange={(e) => save(e.target.value || null)}
            className={cn(inputCls, "max-w-[190px]")}
          />
        </Row>
      );
    case "link": {
      const href = typeof raw === "string" && raw ? (/^https?:\/\//.test(raw) ? raw : `https://${raw}`) : null;
      return (
        <Row label={field.label} htmlFor={id}>
          <TextField id={id} type="url" inputMode="url" value={typeof raw === "string" ? raw : ""} onSave={(v) => save(v || null)} placeholder="Paste a link" />
          {href ? (
            <a href={href} target="_blank" rel="noreferrer noopener" aria-label={`Open ${domain(href)}`} className="shrink-0 text-clay-ink">
              <Icon.External size={14} />
            </a>
          ) : null}
        </Row>
      );
    }
    default:
      return (
        <Row label={field.label} htmlFor={id}>
          <TextField id={id} value={typeof raw === "string" ? raw : raw == null ? "" : String(raw)} onSave={(v) => save(v || null)} placeholder="—" />
        </Row>
      );
  }
}

function PhotoViewer({ photo, onClose, onDelete }: { photo: ItemPhoto | null; onClose: () => void; onDelete: (id: string) => void }) {
  return (
    <Dialog.Root open={!!photo} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[70] bg-black/90" />
        <Dialog.Content className="fixed inset-0 z-[71] flex flex-col outline-none">
          <Dialog.Title className="sr-only">Photo</Dialog.Title>
          <Dialog.Description className="sr-only">Full size photo</Dialog.Description>
          <div className="flex items-center justify-between p-3 safe-top">
            <Dialog.Close aria-label="Close photo" className="flex h-11 w-11 items-center justify-center rounded-xl text-white hover:bg-white/10">
              <Icon.Close />
            </Dialog.Close>
            {photo ? (
              <button
                type="button"
                onClick={() => {
                  onDelete(photo.id);
                  onClose();
                }}
                className="flex h-11 items-center gap-2 rounded-xl px-3 text-[15px] font-medium text-[#f2b596] hover:bg-white/10"
              >
                <Icon.Trash size={18} /> Delete photo
              </button>
            ) : null}
          </div>
          <div className="flex min-h-0 flex-1 items-center justify-center p-4" onClick={onClose}>
            {photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photoSrc(photo)} alt="" className="max-h-full max-w-full rounded-lg object-contain" />
            ) : null}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function ItemDetail({ item, onClose, variant }: { item: Item; onClose: () => void; variant: "page" | "panel" }) {
  const { data, actions, me } = useSpace();
  const list = data.lists.find((l) => l.id === item.list_id);
  const photos = data.photos.filter((p) => p.item_id === item.id).sort((a, b) => a.position - b.position);
  const fields = data.fields.filter((f) => f.list_id === item.list_id).sort((a, b) => a.position - b.position);
  const members = data.space.member_names;
  const labels = data.space.priority_labels;
  const fileRef = useRef<HTMLInputElement>(null);
  const [viewing, setViewing] = useState<ItemPhoto | null>(null);
  const [editingFields, setEditingFields] = useState(false);
  const title = useDraft(item.title);
  const notes = useDraft(item.notes ?? "");
  const titleRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = titleRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight}px`;
    }
  }, [title.draft]);

  const whoOptions = [
    { value: "Both", label: "Both" },
    ...(members.length ? members : me ? [me] : []).slice(0, 3).map((n) => ({ value: n, label: n === me ? "Me" : n })),
  ];
  const panel = variant === "panel";
  const card = cn("rounded-2xl border border-line px-4", panel ? "bg-bg" : "bg-surface");
  const sectionLabel = "text-[13px] font-semibold tracking-[0.6px] text-ink-3 uppercase";
  const openLists = data.lists.filter((l) => !l.archived_at && l.id !== item.list_id);

  return (
    <div className={cn("flex min-h-full flex-col", panel ? "bg-surface" : "bg-bg")}>
      <header className={cn("flex items-center justify-between px-2 pt-3 safe-top", panel && "px-4 pt-4")}>
        <button type="button" onClick={onClose} aria-label="Close" className="flex h-11 w-11 items-center justify-center rounded-xl hover:bg-sunken">
          <Icon.Close />
        </button>
        <span className="flex min-w-0 items-center gap-1.5 truncate text-[13px] text-ink-3">
          {panel ? `Edited ${item.updated_by ? `by ${item.updated_by} ` : ""}· ${relativeTime(item.updated_at)}` : list?.name}
        </span>
        <Menu>
          <MenuTrigger aria-label="Item options" className="flex h-11 w-11 items-center justify-center rounded-xl hover:bg-sunken">
            <Icon.More />
          </MenuTrigger>
          <MenuContent>
            <MenuLabel>Move to</MenuLabel>
            {openLists.map((l) => (
              <MenuItem key={l.id} icon={<ListGlyph emoji={l.emoji} size={18} />} onSelect={() => actions.updateItem(item.id, { list_id: l.id })}>
                {l.name}
              </MenuItem>
            ))}
            <MenuItem danger icon={<Icon.Trash size={18} />} onSelect={() => { onClose(); actions.deleteItem(item.id); }}>
              Delete item
            </MenuItem>
          </MenuContent>
        </Menu>
      </header>

      <div className={cn("flex flex-col gap-4 px-5 pt-2", panel && "px-7")}>
        <label htmlFor="f-title" className="sr-only">Title</label>
        <textarea
          id="f-title"
          ref={titleRef}
          rows={1}
          value={title.draft}
          maxLength={300}
          onChange={(e) => title.setDraft(e.target.value.replace(/\n/g, " "))}
          {...title.bind}
          onBlur={() => {
            const t = title.draft.trim();
            if (!t) title.setDraft(item.title);
            else if (t !== item.title) actions.updateItem(item.id, { title: t });
          }}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), (e.target as HTMLTextAreaElement).blur())}
          className={cn(
            "-mx-1 resize-none overflow-hidden rounded-lg bg-transparent px-1 font-display leading-[1.15] font-semibold tracking-[-0.4px] outline-none focus:bg-sunken",
            panel ? "text-[28px]" : "text-[30px]",
          )}
        />
        <Segmented<Status>
          label="Status"
          value={item.status}
          size={panel ? "sm" : "md"}
          options={[
            { value: "idea", label: "Idea" },
            { value: "planned", label: "Planned" },
            { value: "done", label: "Done" },
          ]}
          onChange={(v) => v && actions.updateItem(item.id, { status: v })}
        />
      </div>

      <div className={cn("no-scrollbar flex gap-2 overflow-x-auto px-5 pt-[18px]", panel && "px-7")}>
        {photos.map((p) => (
          <PhotoThumb key={p.id} photo={p} width={panel ? 110 : 128} height={panel ? 88 : 128} radius={14} onClick={() => setViewing(p)} />
        ))}
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className={cn(
            "flex shrink-0 flex-col items-center justify-center gap-1.5 rounded-[14px] border-[1.5px] border-dashed border-dash text-[13px] font-medium text-ink-2 hover:bg-sunken",
            panel ? "h-[88px] w-[88px]" : "h-32 w-[86px]",
          )}
        >
          <Icon.Camera />
          {photos.length ? "Add" : "Photo"}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            const files = [...(e.target.files ?? [])].slice(0, 6);
            e.target.value = "";
            files.forEach((f) => actions.uploadPhoto(item.id, f));
          }}
        />
      </div>

      <div className={cn("mx-5 mt-5", panel && "mx-7")}>
        <div className={card}>
          <div className="flex flex-col gap-2 border-b border-line-soft py-3">
            <span className="text-[14px] text-ink-3">Priority</span>
            <Segmented<number>
              label="Priority"
              size="sm"
              allowClear
              value={item.priority}
              options={labels.map((l, i) => ({ value: i, label: l }))}
              onChange={(v) => actions.updateItem(item.id, { priority: v as 0 | 1 | 2 | null })}
            />
          </div>
          <Row label="Budget" htmlFor="f-price">
            <TextField
              id="f-price"
              type="number"
              inputMode="decimal"
              value={item.price === null ? "" : String(item.price)}
              placeholder="—"
              onSave={(v) =>
                actions.updateItem(item.id, {
                  price: v === "" ? null : Math.max(0, Number(v)),
                  ...(v !== "" && !item.currency ? { currency: data.space.default_currency } : {}),
                })
              }
            />
            <select
              aria-label="Currency"
              value={item.currency ?? data.space.default_currency}
              onChange={(e) => actions.updateItem(item.id, { currency: e.target.value })}
              className="rounded-md bg-transparent py-1 text-[14px] text-ink-3 outline-none focus:bg-sunken"
            >
              {[...new Set([data.space.default_currency, ...CURRENCIES])].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Row>
          <Row label="Target date" htmlFor="f-date">
            <input
              id="f-date"
              type="date"
              value={item.target_date ?? ""}
              onChange={(e) => actions.updateItem(item.id, { target_date: e.target.value || null })}
              className={cn(inputCls, "max-w-[190px]")}
            />
          </Row>
          <Row label="Link" htmlFor="f-url">
            <TextField id="f-url" type="url" inputMode="url" value={item.url ? item.url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "") : ""} placeholder="Paste a link" onSave={(v) => actions.updateItem(item.id, { url: v || null })} />
            {item.url ? (
              <a href={item.url} target="_blank" rel="noreferrer noopener" aria-label={`Open ${domain(item.url)}`} className="shrink-0 text-clay-ink">
                <Icon.External size={14} />
              </a>
            ) : null}
          </Row>
          <Row label="Location" htmlFor="f-loc">
            <TextField id="f-loc" value={item.location ?? ""} placeholder="Add a place" onSave={(v) => actions.updateItem(item.id, { location: v || null })} />
            {item.location ? (
              <a href={mapsLink(item.location)} target="_blank" rel="noreferrer noopener" aria-label="Open in maps" className="shrink-0 text-clay-ink">
                <Icon.External size={14} />
              </a>
            ) : null}
          </Row>
          <div className="flex flex-col gap-2 border-b border-line-soft py-3">
            <span className="text-[14px] text-ink-3">Who wants it</span>
            <Segmented<string>
              label="Who wants it"
              size="sm"
              allowClear
              value={item.who_wants}
              options={whoOptions}
              onChange={(v) => actions.updateItem(item.id, { who_wants: v })}
            />
          </div>
          <Row label="Tags" htmlFor="f-tags">
            <TagsField item={item} />
          </Row>
        </div>
      </div>

      <div className={cn("flex items-baseline justify-between px-5 pt-5", panel && "px-7")}>
        <h2 className={sectionLabel}>Fields for this list</h2>
        <button type="button" onClick={() => setEditingFields(true)} className="h-8 text-[13px] font-semibold text-clay-ink">
          {fields.length ? "Edit fields" : "Add a field"}
        </button>
      </div>
      {fields.length ? (
        <div className={cn("mx-5 mt-2", panel && "mx-7")}>
          <div className={card}>
            {fields.map((f) => (
              <CustomField key={f.id} item={item} field={f} />
            ))}
          </div>
        </div>
      ) : null}

      <div className={cn("flex flex-col gap-2 px-5 pt-5", panel && "px-7")}>
        <label htmlFor="f-notes" className={sectionLabel}>Notes</label>
        <textarea
          id="f-notes"
          value={notes.draft}
          onChange={(e) => notes.setDraft(e.target.value)}
          {...notes.bind}
          onBlur={() => notes.draft !== (item.notes ?? "") && actions.updateItem(item.id, { notes: notes.draft || null })}
          placeholder="Anything worth remembering…"
          rows={4}
          maxLength={10000}
          className={cn(
            "min-h-24 resize-y rounded-2xl border border-line px-4 py-3.5 text-[15px] leading-[1.45] outline-none focus:border-ink-3",
            panel ? "bg-bg" : "bg-surface",
          )}
        />
      </div>

      <div className={cn("px-5 pt-4 text-[13px] leading-normal text-ink-3", panel && "px-7")}>
        Added {item.added_by ? `by ${item.added_by === me ? "you" : item.added_by} ` : ""}· {shortDate(item.created_at)}
        {item.updated_at !== item.created_at ? (
          <>
            <br />
            Edited {item.updated_by ? `by ${item.updated_by === me ? "you" : item.updated_by} ` : ""}· {relativeTime(item.updated_at)}
          </>
        ) : null}
        {item.done_at ? (
          <>
            <br />
            Done · {shortDate(item.done_at)}
          </>
        ) : null}
      </div>

      <div className={cn("mt-auto grid grid-cols-2 gap-2.5 p-5 pb-8", panel && "px-7")}>
        <Menu>
          <MenuTrigger className="h-[50px] rounded-[14px] border border-line-2 text-[15px] font-medium hover:bg-sunken">Move to list</MenuTrigger>
          <MenuContent align="start">
            {openLists.length ? (
              openLists.map((l) => (
                <MenuItem
                  key={l.id}
                  icon={
                    <span className="flex h-6 w-6 items-center justify-center rounded-md" style={tileStyle(l.color)}>
                      <ListGlyph emoji={l.emoji} size={14} />
                    </span>
                  }
                  onSelect={() => actions.updateItem(item.id, { list_id: l.id })}
                >
                  {l.name}
                </MenuItem>
              ))
            ) : (
              <MenuLabel>No other lists yet</MenuLabel>
            )}
          </MenuContent>
        </Menu>
        <button
          type="button"
          onClick={() => {
            onClose();
            actions.deleteItem(item.id);
          }}
          className="h-[50px] rounded-[14px] border border-danger-line text-[15px] font-medium text-danger hover:bg-sunken"
        >
          Delete
        </button>
      </div>

      <PhotoViewer photo={viewing} onClose={() => setViewing(null)} onDelete={actions.deletePhoto} />
      {list ? <FieldsEditor open={editingFields} onOpenChange={setEditingFields} list={list} /> : null}
    </div>
  );
}
