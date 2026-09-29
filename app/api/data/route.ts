import type { NextRequest } from "next/server";
import { spaceFromRequest, unauthorized } from "@/lib/session";
import { HttpError, loadSpaceData } from "@/lib/server-data";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const spaceId = await spaceFromRequest(req);
  if (!spaceId) return unauthorized();
  try {
    return Response.json(await loadSpaceData(spaceId), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    if (e instanceof HttpError && e.status === 401) return unauthorized();
    console.error(e);
    return Response.json({ error: "Couldn't load your lists." }, { status: 500 });
  }
}
