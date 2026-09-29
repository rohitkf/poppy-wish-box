export type Status = "idea" | "planned" | "done";
export type FieldType = "text" | "number" | "date" | "link" | "select" | "checkbox";
export type ListColor = "clay" | "teal" | "plum" | "olive" | "sky" | "rose";

export interface Space {
  id: string;
  name: string;
  member_names: string[];
  priority_labels: string[];
  default_currency: string;
}

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

export type SpacePatch = Partial<Pick<Space, "name" | "member_names" | "priority_labels" | "default_currency">>;

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
  | { op: "photo.delete"; id: string };

/** Change broadcast from the server over SSE. */
export interface ChangeEvent {
  table: "spaces" | "lists" | "field_defs" | "items" | "item_photos" | "presence";
  op: "INSERT" | "UPDATE" | "DELETE";
  id: string;
  row: Record<string, unknown> | null;
  refetch?: boolean;
}
