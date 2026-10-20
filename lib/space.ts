import "server-only";
import { db } from "@/lib/db";

// A deployment holds one shared space: every unlocked request reads and writes it.
// Its id never changes, so it's cached per instance.
const g = globalThis as unknown as { oursSpaceId?: string };

/** The space's id, or null until `npm run setup` has created it. */
export async function currentSpaceId(): Promise<string | null> {
  if (g.oursSpaceId) return g.oursSpaceId;
  const { rows } = await db().query("select id from spaces order by created_at limit 1");
  if (rows[0]) g.oursSpaceId = rows[0].id;
  return g.oursSpaceId ?? null;
}

export function noSpace() {
  return Response.json(
    { error: "This space isn't set up yet. Redeploy production (locally: npm run setup)." },
    { status: 503, headers: { "Cache-Control": "no-store" } },
  );
}
