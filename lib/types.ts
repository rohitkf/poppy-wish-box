export type Status = "idea" | "planned" | "done";
export type FieldType = "text" | "number" | "date" | "link" | "select" | "checkbox";
export type ListColor = "clay" | "teal" | "plum" | "olive" | "sky" | "rose";

export interface Space {
  id: string;
  name: string;
  member_names: string[];
  priority_labels: string[];
  default_currency: string;
  /** Where pantry items can live: the presets plus any the couple added. */
  pantry_locations: string[];
  /** An item is "expiring soon" this many days (or fewer) before its date. */
  expiry_warn_days: number;
}

export interface PantryItem {
  id: string;
  space_id: string;
  name: string;
  location: string;
  category: string | null;
  quantity: number | null;
  unit: string | null;
  /** YYYY-MM-DD */
  expires_on: string | null;
  /** YYYY-MM-DD */
  opened_on: string | null;
  /** The best-before / use-by printed on the pack (expires_on is what the warnings use). */
  package_expires_on: string | null;
  /** When it went into the freezer, and when it came out to defrost. */
  frozen_on: string | null;
  defrosted_on: string | null;
  added_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export const PANTRY_FIELDS = [
  "name",
  "location",
  "category",
  "quantity",
  "unit",
  "expires_on",
  "opened_on",
  "package_expires_on",
  "frozen_on",
  "defrosted_on",
] as const;
export type PantryPatch = Partial<Pick<PantryItem, (typeof PANTRY_FIELDS)[number]>>;

export type Repeat = "none" | "weekly" | "monthly" | "yearly";

export interface CalendarEvent {
  id: string;
  space_id: string;
  title: string;
  /** A key from EVENT_KINDS in lib/calendar.ts (Day off, Travel, …). */
  kind: string;
  /** #rrggbb */
  color: string;
  /** YYYY-MM-DD; for a repeating event, the first time it happens. */
  start_date: string;
  /** YYYY-MM-DD, inclusive. */
  end_date: string;
  /** HH:MM, or null for an all-day event. */
  start_time: string | null;
  end_time: string | null;
  /** Who it's for; empty means everyone. */
  who: string[];
  location: string | null;
  notes: string | null;
  repeat: Repeat;
  /** Last date a repeat may start on; null repeats for ever. */
  repeat_until: string | null;
  /** Start dates of single occurrences that were deleted from a repeating event. */
  skip_dates: string[];
  /** Morning reminder this many days before (0 = on the day); null for none. */
  remind_days: number | null;
  added_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export const EVENT_FIELDS = [
  "title",
  "kind",
  "color",
  "start_date",
  "end_date",
  "start_time",
  "end_time",
  "who",
  "location",
  "notes",
  "repeat",
  "repeat_until",
  "skip_dates",
  "remind_days",
] as const;
export type EventPatch = Partial<Pick<CalendarEvent, (typeof EVENT_FIELDS)[number]>>;

export interface List {
  id: string;
  space_id: string;
  name: string;
  emoji: string;
  color: ListColor;
  position: number;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface FieldDef {
  id: string;
  space_id: string;
  list_id: string;
  key: string;
  label: string;
  type: FieldType;
  options: string[];
  position: number;
}

export type CustomValue = string | number | boolean | null;

export interface Item {
  id: string;
  space_id: string;
  list_id: string;
  title: string;
  notes: string | null;
  url: string | null;
  price: number | null;
  currency: string | null;
  priority: 0 | 1 | 2 | null;
  target_date: string | null;
  status: Status;
  location: string | null;
  tags: string[];
  who_wants: string | null;
  added_by: string | null;
  updated_by: string | null;
  position: number;
  custom: Record<string, CustomValue>;
  created_at: string;
  updated_at: string;
  done_at: string | null;
}

export interface ItemPhoto {
  id: string;
  space_id: string;
  item_id: string;
  width: number | null;
  height: number | null;
  position: number;
  created_at: string;
}

export interface Presence {
  device_id: string;
  name: string;
  last_seen: string;
}

export interface SpaceData {
  space: Space;
  lists: List[];
  fields: FieldDef[];
  items: Item[];
  photos: ItemPhoto[];
  presence: Presence[];
  pantry: PantryItem[];
  events: CalendarEvent[];
}

/** Editable item columns (besides custom, which merges per key). */
export const ITEM_FIELDS = [
  "title",
  "notes",
  "url",
  "price",
  "currency",
  "priority",
  "target_date",
  "status",
  "location",
  "tags",
  "who_wants",
  "list_id",
  "position",
] as const;
export type ItemField = (typeof ITEM_FIELDS)[number];
export type ItemPatch = Partial<Pick<Item, ItemField>> & { custom?: Record<string, CustomValue> };

export const LIST_FIELDS = ["name", "emoji", "color", "position", "archived_at"] as const;
export type ListPatch = Partial<Pick<List, (typeof LIST_FIELDS)[number]>>;

export const FIELD_DEF_FIELDS = ["label", "type", "options", "position"] as const;
export type FieldDefPatch = Partial<Pick<FieldDef, (typeof FIELD_DEF_FIELDS)[number]>>;

export type SpacePatch = Partial<
  Pick<Space, "name" | "member_names" | "priority_labels" | "default_currency" | "pantry_locations" | "expiry_warn_days">
>;

/** Mutations the client can send to /api/mutate. Ids are client-generated. */
export type Mutation =
  | { op: "list.create"; list: Pick<List, "id" | "name" | "emoji" | "color" | "position"> }
  | { op: "list.update"; id: string; patch: ListPatch }
  | { op: "list.delete"; id: string }
  | { op: "list.reorder"; order: { id: string; position: number }[] }
  | { op: "item.create"; item: Pick<Item, "id" | "list_id" | "title"> & Partial<Pick<Item, ItemField>>; actor: string | null }
  | { op: "item.update"; id: string; patch: ItemPatch; actor: string | null }
  | { op: "item.delete"; id: string }
  | { op: "field.create"; field: Pick<FieldDef, "id" | "list_id" | "label" | "type" | "options" | "position"> }
  | { op: "field.update"; id: string; patch: FieldDefPatch }
  | { op: "field.delete"; id: string }
  | { op: "space.update"; patch: SpacePatch }
  | { op: "photo.delete"; id: string }
  | { op: "pantry.create"; item: Pick<PantryItem, "id" | "name"> & PantryPatch; actor: string | null }
  | { op: "pantry.update"; id: string; patch: PantryPatch; actor: string | null }
  | { op: "pantry.delete"; id: string }
  | { op: "event.create"; event: Pick<CalendarEvent, "id" | "title" | "start_date" | "end_date"> & EventPatch; actor: string | null }
  | { op: "event.update"; id: string; patch: EventPatch; actor: string | null }
  | { op: "event.delete"; id: string };

/** Change broadcast from the server over SSE. */
export interface ChangeEvent {
  table: "spaces" | "lists" | "field_defs" | "items" | "item_photos" | "presence" | "pantry_items" | "calendar_events";
  op: "INSERT" | "UPDATE" | "DELETE";
  id: string;
  row: Record<string, unknown> | null;
  refetch?: boolean;
}
