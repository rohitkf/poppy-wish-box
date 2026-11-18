import type { NextRequest } from "next/server";
import type { Holiday } from "@/lib/holidays";
import { isUnlocked, unauthorized } from "@/lib/session";

export const dynamic = "force-dynamic";

type Official = { years: number[]; holidays: Holiday[] };
let cached: { at: number; data: Official } | null = null;
const DAY = 24 * 60 * 60 * 1000;

/** gov.uk's official England & Wales list, fetched at most once a day per server. */
async function official(): Promise<Official | null> {
  if (cached && Date.now() - cached.at < DAY) return cached.data;
  try {
    const res = await fetch("https://www.gov.uk/bank-holidays.json", { signal: AbortSignal.timeout(5000), cache: "no-store" });
    if (!res.ok) throw new Error(`gov.uk answered ${res.status}`);
    const json = (await res.json()) as { "england-and-wales"?: { events?: { date: string; title: string; notes?: string }[] } };
    const events = json["england-and-wales"]?.events ?? [];
    const holidays = events
      .filter((e) => /^\d{4}-\d{2}-\d{2}$/.test(e.date) && typeof e.title === "string")
      .map((e) => ({ date: e.date, title: e.title.slice(0, 120), ...(/substitute/i.test(e.notes ?? "") && { substitute: true }) }));
    // Only whole years: one with fewer than the usual eight days may be half published.
    const count = new Map<number, number>();
    for (const h of holidays) count.set(Number(h.date.slice(0, 4)), (count.get(Number(h.date.slice(0, 4))) ?? 0) + 1);
    const years = [...count].filter(([, n]) => n >= 8).map(([y]) => y);
    if (!years.length) throw new Error("gov.uk sent no holidays");
    cached = { at: Date.now(), data: { years, holidays } };
  } catch (e) {
    console.error(JSON.stringify({ level: "warn", msg: "bank holidays fetch failed", error: (e as Error).message }));
    // Keep yesterday's copy if there is one; otherwise the app falls back to the usual rules.
    if (cached) cached.at = Date.now() - DAY + 60 * 60 * 1000;
  }
  return cached?.data ?? null;
}

export async function GET(req: NextRequest) {
  if (!(await isUnlocked(req))) return unauthorized();
  const data = await official();
  return Response.json(data ?? { years: [], holidays: [] }, { headers: { "Cache-Control": "private, max-age=86400" } });
}
