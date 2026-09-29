import type { NextRequest } from "next/server";
import { get } from "@vercel/blob";
import { db } from "@/lib/db";
import { spaceFromRequest, unauthorized } from "@/lib/session";

export const dynamic = "force-dynamic";

/** Streams a private photo to devices in its space. Photo ids never change content. */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const spaceId = await spaceFromRequest(req);
  if (!spaceId) return unauthorized();
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Not found", { status: 404 });

  const { rows } = await db().query("select blob_url from item_photos where id = $1 and space_id = $2", [
    id,
    spaceId,
  ]);
  if (!rows[0]) return new Response("Not found", { status: 404 });

  const cacheHeaders = { "Cache-Control": "private, max-age=31536000, immutable", ETag: `"${id}"` };
  if (req.headers.get("if-none-match") === `"${id}"`) return new Response(null, { status: 304, headers: cacheHeaders });

  const result = await get(rows[0].blob_url, { access: "private" });
  if (!result || result.statusCode !== 200) return new Response("Not found", { status: 404 });

  return new Response(result.stream, {
    headers: { ...cacheHeaders, "Content-Type": result.blob.contentType, "Content-Length": String(result.blob.size) },
  });
}
