import "server-only";
import { del } from "@vercel/blob";
import { db } from "@/lib/db";
import type { CustomValue, Mutation, SpaceData } from "@/lib/types";

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

// ─── Validation ─────────────────────────────────────────────────────────────

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const COLORS = ["clay", "teal", "plum", "olive", "sky", "rose"];
const FIELD_TYPES = ["text", "number", "date", "link", "select", "checkbox"];
const STATUSES = ["idea", "planned", "done"];

const bad = (msg: string): never => {
  throw new HttpError(400, msg);
};

export function uuid(v: unknown, name = "id"): string {
  return typeof v === "string" && UUID.test(v) ? v : bad(`Invalid ${name}`);
}

function text(v: unknown, name: string, max: number, opts: { required?: boolean } = {}): string | null {
  if (v === null || v === undefined || v === "") {
    return opts.required ? bad(`${name} is required`) : null;
  }
  if (typeof v !== "string") return bad(`Invalid ${name}`);
  const s = v.trim();
  if (!s) return opts.required ? bad(`${name} is required`) : null;
  if (s.length > max) return bad(`${name} is too long`);
  return s;
}

function num(v: unknown, name: string, { min = -1e12, max = 1e12 } = {}): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n) || n < min || n > max) return bad(`Invalid ${name}`);
  return n;
}

function url(v: unknown): string | null {
  const s = text(v, "Link", 2000);
  if (!s) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(s) ? s : `https://${s}`;
  try {
    const u = new URL(withScheme);
    if (u.protocol !== "http:" && u.protocol !== "https:") return bad("Links must be http(s)");
    return u.toString();
  } catch {
    return bad("That link doesn't look right");
  }
}

function strArray(v: unknown, name: string, maxItems: number, maxLen: number): string[] {
  if (v === null || v === undefined) return [];
  if (!Array.isArray(v) || v.length > maxItems) return bad(`Invalid ${name}`);
  const out: string[] = [];
  for (const x of v) {
    const s = text(x, name, maxLen);
    if (s && !out.includes(s)) out.push(s);
  }
  return out;
}

function customValues(v: unknown): Record<string, CustomValue> {
  if (!v || typeof v !== "object" || Array.isArray(v)) return bad("Invalid custom fields");
  const out: Record<string, CustomValue> = {};
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    if (!/^[a-z0-9_]{1,48}$/.test(k)) bad("Invalid custom field key");
    if (val === null || typeof val === "boolean") out[k] = val;
    else if (typeof val === "number" && Number.isFinite(val)) out[k] = val;
    else if (typeof val === "string" && val.length <= 2000) out[k] = val.trim() || null;
    else bad("Invalid custom field value");
  }
  return out;
}

type Cols = Record<string, unknown>;

/** Validates an item patch into SQL-ready column values. Unknown keys are ignored. */
function itemCols(p: Record<string, unknown>): Cols {
  const c: Cols = {};
  if ("title" in p) c.title = text(p.title, "Title", 300, { required: true });
  if ("notes" in p) c.notes = text(p.notes, "Notes", 10000);
  if ("url" in p) c.url = url(p.url);
  if ("price" in p) c.price = num(p.price, "Price", { min: 0, max: 1e10 });
  if ("currency" in p) {
    const cur = text(p.currency, "Currency", 3);
    c.currency = cur && /^[A-Za-z]{3}$/.test(cur) ? cur.toUpperCase() : cur ? bad("Invalid currency") : null;
  }
  if ("priority" in p) {
    const pr = p.priority;
    c.priority = pr === null || pr === 0 || pr === 1 || pr === 2 ? pr : bad("Invalid priority");
  }
  if ("target_date" in p) {
    const d = p.target_date;
    c.target_date = d === null || d === "" ? null : typeof d === "string" && DATE.test(d) ? d : bad("Invalid date");
  }
  if ("status" in p) c.status = STATUSES.includes(p.status as string) ? p.status : bad("Invalid status");
  if ("location" in p) c.location = text(p.location, "Location", 300);
  if ("tags" in p) c.tags = strArray(p.tags, "Tags", 20, 40);
  if ("who_wants" in p) c.who_wants = text(p.who_wants, "Who wants it", 60);
  if ("list_id" in p) c.list_id = uuid(p.list_id, "list");
  if ("position" in p) c.position = num(p.position, "Position") ?? 0;
  return c;
}

function listCols(p: Record<string, unknown>): Cols {
  const c: Cols = {};
  if ("name" in p) c.name = text(p.name, "List name", 80, { required: true });
  if ("emoji" in p) c.emoji = text(p.emoji, "Icon", 40) ?? "icon:star";
  if ("color" in p) c.color = COLORS.includes(p.color as string) ? p.color : bad("Invalid colour");
  if ("position" in p) c.position = num(p.position, "Position") ?? 0;
  if ("archived_at" in p) c.archived_at = p.archived_at ? new Date().toISOString() : null;
  return c;
}

function fieldCols(p: Record<string, unknown>): Cols {
  const c: Cols = {};
  if ("label" in p) c.label = text(p.label, "Field name", 60, { required: true });
  if ("type" in p) c.type = FIELD_TYPES.includes(p.type as string) ? p.type : bad("Invalid field type");
  if ("options" in p) c.options = strArray(p.options, "Options", 30, 40);
  if ("position" in p) c.position = num(p.position, "Position") ?? 0;
  return c;
}

function spaceCols(p: Record<string, unknown>): Cols {
  const c: Cols = {};
  if ("name" in p) c.name = text(p.name, "Space name", 60, { required: true });
  if ("member_names" in p) c.member_names = strArray(p.member_names, "Names", 8, 40);
  if ("priority_labels" in p) {
    const labels = strArray(p.priority_labels, "Priority labels", 3, 20);
    c.priority_labels = labels.length === 3 ? labels : bad("Give all three priority labels");
  }
  if ("default_currency" in p) {
    const cur = text(p.default_currency, "Currency", 3);
    c.default_currency = cur && /^[A-Za-z]{3}$/.test(cur) ? cur.toUpperCase() : bad("Invalid currency");
  }
  return c;
}

/** Builds `col = $n` assignments; returns SQL fragment and pushes params. */
function assignments(cols: Cols, params: unknown[]) {
  return Object.entries(cols).map(([k, v]) => {
    params.push(v);
    return `${k} = $${params.length}`;
  });
}

function slug(label: string) {
  return (
    label
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 36) || "field"
  );
}

async function deleteBlobs(urls: string[]) {
  if (!urls.length || !process.env.BLOB_READ_WRITE_TOKEN) return;
  try {
    await del(urls);
  } catch (e) {
    console.error("Blob cleanup failed", e);
  }
}

// ─── Reads ──────────────────────────────────────────────────────────────────

export async function loadSpaceData(spaceId: string): Promise<SpaceData> {
  const pool = db();
  const [space, lists, fields, items, photos, presence] = await Promise.all([
    pool.query(
      "select id, name, member_names, priority_labels, default_currency from spaces where id = $1",
      [spaceId],
    ),
    pool.query("select * from lists where space_id = $1 order by position, created_at", [spaceId]),
    pool.query("select * from field_defs where space_id = $1 order by position, created_at", [spaceId]),
    pool.query("select * from items where space_id = $1 order by created_at desc", [spaceId]),
    pool.query(
      "select id, space_id, item_id, width, height, position, created_at from item_photos where space_id = $1 order by position, created_at",
      [spaceId],
    ),
    pool.query(
      "select device_id, name, last_seen from presence where space_id = $1 and last_seen > now() - interval '90 seconds'",
      [spaceId],
    ),
  ]);
  if (!space.rows[0]) throw new HttpError(404, "This space no longer exists.");
  return {
    space: space.rows[0],
    lists: lists.rows,
    fields: fields.rows,
    items: items.rows,
    photos: photos.rows,
    presence: presence.rows,
  };
}

// ─── Writes ─────────────────────────────────────────────────────────────────

export async function applyMutation(spaceId: string, m: Mutation): Promise<unknown> {
  const pool = db();
  switch (m?.op) {
    case "list.create": {
      const l = m.list ?? bad("Missing list");
      const cols = listCols({ name: l.name, emoji: l.emoji, color: l.color ?? "clay", position: l.position });
      const { rows } = await pool.query(
        `insert into lists (id, space_id, name, emoji, color, position) values ($1, $2, $3, $4, $5, $6)
         on conflict (id) do nothing returning *`,
        [uuid(l.id), spaceId, cols.name, cols.emoji, cols.color, cols.position],
      );
      return rows[0] ?? null;
    }
    case "list.update": {
      const cols = listCols(m.patch ?? {});
      if (!Object.keys(cols).length) return null;
      const params: unknown[] = [];
      const set = assignments(cols, params);
      params.push(uuid(m.id), spaceId);
      const { rows } = await pool.query(
        `update lists set ${set.join(", ")} where id = $${params.length - 1} and space_id = $${params.length} returning *`,
        params,
      );
      return rows[0] ?? bad("List not found");
    }
    case "list.delete": {
      const id = uuid(m.id);
      const photos = await pool.query(
        `select p.blob_url from item_photos p join items i on i.id = p.item_id
          where i.list_id = $1 and p.space_id = $2`,
        [id, spaceId],
      );
      await pool.query("delete from lists where id = $1 and space_id = $2", [id, spaceId]);
      await deleteBlobs(photos.rows.map((r) => r.blob_url));
      return null;
    }
    case "list.reorder": {
      if (!Array.isArray(m.order) || m.order.length > 200) bad("Invalid order");
      const ids = m.order.map((o) => uuid(o.id));
      const positions = m.order.map((o) => num(o.position, "Position") ?? 0);
      await pool.query(
        `update lists l set position = v.position
           from unnest($1::uuid[], $2::float8[]) as v(id, position)
          where l.id = v.id and l.space_id = $3`,
        [ids, positions, spaceId],
      );
      return null;
    }
    case "item.create": {
      const it = m.item ?? bad("Missing item");
      const cols = itemCols({ ...it, title: it.title });
      delete cols.list_id;
      const listId = uuid(it.list_id, "list");
      const actor = text(m.actor, "Name", 40);
      const names = ["id", "space_id", "list_id", "added_by", "updated_by", ...Object.keys(cols)];
      const values = [uuid(it.id), spaceId, listId, actor, actor, ...Object.values(cols)];
      if (cols.status === "done") {
        names.push("done_at");
        values.push(new Date().toISOString());
      }
      const ph = values.map((_, i) => `$${i + 1}`);
      const { rows } = await pool.query(
        `insert into items (${names.join(", ")})
         select ${ph.join(", ")} where exists (select 1 from lists where id = $3 and space_id = $2)
         on conflict (id) do nothing returning *`,
        values,
      );
      return rows[0] ?? null;
    }
    case "item.update": {
      const patch = (m.patch ?? {}) as Record<string, unknown>;
      const cols = itemCols(patch);
      const params: unknown[] = [];
      const set = assignments(cols, params);
      if ("status" in cols) {
        set.push(`done_at = case when status = 'done' and $${params.length} = 'done' then done_at
                                 when $${params.length} = 'done' then now() else null end`);
      }
      if (patch.custom !== undefined) {
        const custom = customValues(patch.custom);
        const merge = Object.fromEntries(Object.entries(custom).filter(([, v]) => v !== null));
        const remove = Object.keys(custom).filter((k) => custom[k] === null);
        params.push(JSON.stringify(merge), remove);
        set.push(`custom = (custom || $${params.length - 1}::jsonb) - $${params.length}::text[]`);
      }
      if (!set.length) return null;
      params.push(text(m.actor, "Name", 40));
      set.push(`updated_by = coalesce($${params.length}, updated_by)`);
      params.push(uuid(m.id), spaceId);
      const idP = params.length - 1;
      const spP = params.length;
      let guard = "";
      if ("list_id" in cols) {
        params.push(cols.list_id);
        guard = ` and exists (select 1 from lists where id = $${params.length} and space_id = $${spP})`;
      }
      const { rows } = await pool.query(
        `update items set ${set.join(", ")} where id = $${idP} and space_id = $${spP}${guard} returning *`,
        params,
      );
      if (!rows[0]) throw new HttpError(404, "That item no longer exists");
      return rows[0];
    }
    case "item.delete": {
      const id = uuid(m.id);
      const photos = await pool.query("select blob_url from item_photos where item_id = $1 and space_id = $2", [
        id,
        spaceId,
      ]);
      await pool.query("delete from items where id = $1 and space_id = $2", [id, spaceId]);
      await deleteBlobs(photos.rows.map((r) => r.blob_url));
      return null;
    }
    case "field.create": {
      const f = m.field ?? bad("Missing field");
      const cols = fieldCols({ label: f.label, type: f.type, options: f.options, position: f.position });
      const id = uuid(f.id);
      const key = `${slug(cols.label as string)}_${id.slice(0, 4)}`;
      const { rows } = await pool.query(
        `insert into field_defs (id, space_id, list_id, key, label, type, options, position)
         select $1, $2, $3, $4, $5, $6, $7, $8 where exists (select 1 from lists where id = $3 and space_id = $2)
         on conflict (id) do nothing returning *`,
        [id, spaceId, uuid(f.list_id, "list"), key, cols.label, cols.type, cols.options, cols.position ?? 0],
      );
      return rows[0] ?? null;
    }
    case "field.update": {
      const cols = fieldCols(m.patch ?? {});
      if (!Object.keys(cols).length) return null;
      const params: unknown[] = [];
      const set = assignments(cols, params);
      params.push(uuid(m.id), spaceId);
      const { rows } = await pool.query(
        `update field_defs set ${set.join(", ")} where id = $${params.length - 1} and space_id = $${params.length} returning *`,
        params,
      );
      return rows[0] ?? bad("Field not found");
    }
    case "field.delete": {
      await pool.query("delete from field_defs where id = $1 and space_id = $2", [uuid(m.id), spaceId]);
      return null;
    }
    case "space.update": {
      const cols = spaceCols(m.patch ?? {});
      if (!Object.keys(cols).length) return null;
      const params: unknown[] = [];
      const set = assignments(cols, params);
      params.push(spaceId);
      const { rows } = await pool.query(
        `update spaces set ${set.join(", ")} where id = $${params.length}
         returning id, name, member_names, priority_labels, default_currency`,
        params,
      );
      return rows[0];
    }
    case "photo.delete": {
      const { rows } = await pool.query(
        "delete from item_photos where id = $1 and space_id = $2 returning blob_url",
        [uuid(m.id), spaceId],
      );
      await deleteBlobs(rows.map((r) => r.blob_url));
      return null;
    }
    default:
      return bad("Unknown operation");
  }
}
