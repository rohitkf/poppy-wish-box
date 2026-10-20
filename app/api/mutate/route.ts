import type { NextRequest } from "next/server";
import { currentSpaceId, noSpace } from "@/lib/space";
import { applyMutation, HttpError } from "@/lib/server-data";
import type { Mutation } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const spaceId = await currentSpaceId();
  if (!spaceId) return noSpace();
  let mutation: Mutation;
  try {
    mutation = await req.json();
  } catch {
    return Response.json({ error: "Bad request" }, { status: 400 });
  }
  try {
    const result = await applyMutation(spaceId, mutation);
    return Response.json({ ok: true, row: result ?? null });
  } catch (e) {
    if (e instanceof HttpError) return Response.json({ error: e.message }, { status: e.status });
    console.error(e);
    return Response.json({ error: "Couldn't save that change." }, { status: 500 });
  }
}
