import type { NextRequest } from "next/server";
import { put } from "@vercel/blob";
import { db } from "@/lib/db";
import { isUnlocked, unauthorized } from "@/lib/session";
import { currentSpaceId, noSpace } from "@/lib/space";
import { HttpError, uuid } from "@/lib/server-data";
import { errorHeaders, readForm } from "@/lib/http";

export const dynamic = "force-dynamic";

const MAX_BYTES = 4 * 1024 * 1024; // after on-device compression photos are ~200–600 kB
const MAX_PER_ITEM = 12;
const TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

/** Multipart upload: file, id, itemId, width, height. Stored in a private Blob store. */
export async function POST(req: NextRequest) {
  if (!(await isUnlocked(req))) return unauthorized();
  const spaceId = await currentSpaceId();
  if (!spaceId) return noSpace();

  try {
    // A little headroom over MAX_BYTES for the other form fields.
    const form = await readForm(req, MAX_BYTES + 64 * 1024);
    const file = form.get("file");
    const id = uuid(form.get("id"));
    const itemId = uuid(form.get("itemId"), "item");
    const width = Number(form.get("width")) || null;
    const height = Number(form.get("height")) || null;

    if (!(file instanceof Blob) || !TYPES[file.type]) {
      return Response.json({ error: "Only JPEG, PNG or WebP photos." }, { status: 400 });
    }
    if (file.size > MAX_BYTES) return Response.json({ error: "That photo is too large." }, { status: 413 });

    const pool = db();
    const { rows: check } = await pool.query(
      `select (select count(*)::int from item_photos where item_id = $1) as n,
              exists (select 1 from items where id = $1 and space_id = $2) as ok`,
      [itemId, spaceId],
    );
    if (!check[0]?.ok) return Response.json({ error: "That item no longer exists." }, { status: 404 });
    if (check[0].n >= MAX_PER_ITEM) {
      return Response.json({ error: `Up to ${MAX_PER_ITEM} photos per item.` }, { status: 400 });
    }

    const blob = await put(`${spaceId}/${itemId}/${id}.${TYPES[file.type]}`, file, {
      access: "private",
      contentType: file.type,
      addRandomSuffix: true,
    });

    const { rows } = await pool.query(
      `insert into item_photos (id, space_id, item_id, blob_url, width, height, position)
       values ($1, $2, $3, $4, $5, $6, extract(epoch from now()))
       returning id, space_id, item_id, width, height, position, created_at`,
      [id, spaceId, itemId, blob.url, width, height],
    );
    return Response.json({ ok: true, row: rows[0] });
  } catch (e) {
    if (e instanceof HttpError) {
      const error = e.status === 413 ? "That photo is too large." : e.message;
      return Response.json({ error }, { status: e.status, headers: errorHeaders(e) });
    }
    const msg = e instanceof Error ? e.message : "";
    if (msg.startsWith("Invalid")) return Response.json({ error: msg }, { status: 400 });
    console.error(e);
    return Response.json({ error: "Upload failed. Try again." }, { status: 500 });
  }
}
