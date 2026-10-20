import type { NextRequest } from "next/server";
import { get } from "@vercel/blob";
import { db } from "@/lib/db";
import { isUnlocked, unauthorized } from "@/lib/session";
import { currentSpaceId, noSpace } from "@/lib/space";

export const dynamic = "force-dynamic";

/** Streams a private photo to unlocked devices. Photo ids never change content. */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isUnlocked(req))) return unauthorized();
  const spaceId = await currentSpaceId();
  if (!spaceId) return noSpace();
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
    headers: {
      ...cacheHeaders,
      "Content-Type": result.blob.contentType,
      "Content-Length": String(result.blob.size),
      // Uploaded bytes are only ever images: never let one run as a page.
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
