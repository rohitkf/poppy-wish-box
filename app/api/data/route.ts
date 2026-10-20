import { currentSpaceId, noSpace } from "@/lib/space";
import { HttpError, loadSpaceData } from "@/lib/server-data";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const spaceId = await currentSpaceId();
    if (!spaceId) return noSpace();
    return Response.json(await loadSpaceData(spaceId), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    if (e instanceof HttpError) return Response.json({ error: e.message }, { status: e.status });
    console.error(e);
    return Response.json({ error: "Couldn't load your lists." }, { status: 500 });
  }
}
