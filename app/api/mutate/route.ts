import type { NextRequest } from "next/server";
import { isTransientDbError } from "@/lib/db";
import { errorHeaders, readJson } from "@/lib/http";
import { isUnlocked, unauthorized } from "@/lib/session";
import { currentSpaceId, noSpace } from "@/lib/space";
import { applyMutation, HttpError } from "@/lib/server-data";
import type { Mutation } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!(await isUnlocked(req))) return unauthorized();
  try {
    const spaceId = await currentSpaceId();
    if (!spaceId) return noSpace();
    const mutation = (await readJson(req, 256 * 1024)) as Mutation;
    const result = await applyMutation(spaceId, mutation);
    return Response.json({ ok: true, row: result ?? null });
  } catch (e) {
    if (e instanceof HttpError) {
      return Response.json({ error: e.message }, { status: e.status, headers: errorHeaders(e) });
    }
    // The database is briefly unreachable: the app keeps the change and retries.
    if (isTransientDbError(e)) {
      return Response.json({ error: "Saving is briefly unavailable." }, { status: 503, headers: { "Retry-After": "5" } });
    }
    console.error(e);
    return Response.json({ error: "Couldn't save that change." }, { status: 500 });
  }
}
