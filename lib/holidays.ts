// England & Wales bank holidays. gov.uk publishes the official list a year or two ahead
// (/api/holidays passes it on); for any other year they're worked out here from the usual rules,
// so the calendar can show them as far ahead as you plan. Nothing is stored in the database.
import { addDays, weekday } from "@/lib/calendar";

export interface Holiday {
  date: string;
  title: string;
  substitute?: boolean;
}

/** Easter Sunday (anonymous Gregorian algorithm). */
export function easter(year: number) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

const firstMonday = (y: number, m: number) => {
  const first = `${y}-${String(m).padStart(2, "0")}-01`;
  return addDays(first, (7 - weekday(first)) % 7);
};
const lastMonday = (y: number, m: number) => {
  const last = addDays(m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`, -1);
  return addDays(last, -weekday(last));
};

// Years the usual pattern was changed by royal proclamation.
const SPECIAL: Record<number, { move?: Record<string, string>; add?: Holiday[] }> = {
  1995: { move: { "Early May bank holiday": "1995-05-08" } },
  1999: { add: [{ date: "1999-12-31", title: "Millennium Celebrations" }] },
  2002: { move: { "Spring bank holiday": "2002-06-04" }, add: [{ date: "2002-06-03", title: "Golden Jubilee bank holiday" }] },
  2011: { add: [{ date: "2011-04-29", title: "Royal wedding" }] },
  2012: { move: { "Spring bank holiday": "2012-06-04" }, add: [{ date: "2012-06-05", title: "Queen’s Diamond Jubilee" }] },
  2020: { move: { "Early May bank holiday (VE day)": "2020-05-08" } },
  2022: {
    move: { "Spring bank holiday": "2022-06-02" },
    add: [
      { date: "2022-06-03", title: "Platinum Jubilee bank holiday" },
      { date: "2022-09-19", title: "Bank Holiday for the State Funeral of Queen Elizabeth II" },
    ],
  },
  2023: { add: [{ date: "2023-05-08", title: "Bank holiday for the coronation of King Charles III" }] },
};

export function englandAndWales(year: number): Holiday[] {
  const e = easter(year);
  const out: Holiday[] = [];
  const ny = `${year}-01-01`;
  const nyDow = weekday(ny);
  out.push(nyDow >= 5 ? { date: addDays(ny, 7 - nyDow), title: "New Year’s Day", substitute: true } : { date: ny, title: "New Year’s Day" });
  out.push({ date: addDays(e, -2), title: "Good Friday" });
  out.push({ date: addDays(e, 1), title: "Easter Monday" });
  out.push({ date: firstMonday(year, 5), title: year === 2020 ? "Early May bank holiday (VE day)" : "Early May bank holiday" });
  out.push({ date: lastMonday(year, 5), title: "Spring bank holiday" });
  out.push({ date: lastMonday(year, 8), title: "Summer bank holiday" });
  const xmas = `${year}-12-25`;
  const dow = weekday(xmas);
  if (dow === 4) {
    // Friday: Boxing Day (Saturday) moves to Monday.
    out.push({ date: xmas, title: "Christmas Day" }, { date: `${year}-12-28`, title: "Boxing Day", substitute: true });
  } else if (dow === 5) {
    out.push({ date: `${year}-12-27`, title: "Christmas Day", substitute: true }, { date: `${year}-12-28`, title: "Boxing Day", substitute: true });
  } else if (dow === 6) {
    out.push({ date: `${year}-12-26`, title: "Boxing Day" }, { date: `${year}-12-27`, title: "Christmas Day", substitute: true });
  } else {
    out.push({ date: xmas, title: "Christmas Day" }, { date: `${year}-12-26`, title: "Boxing Day" });
  }
  const special = SPECIAL[year];
  if (special?.move) for (const h of out) if (special.move[h.title]) h.date = special.move[h.title];
  if (special?.add) out.push(...special.add);
  return out.sort((a, b) => (a.date < b.date ? -1 : 1));
}

/** Official dates where gov.uk has them, the rules everywhere else. */
export function holidaysFor(years: number[], official?: { years: number[]; holidays: Holiday[] } | null): Holiday[] {
  const have = new Set(official?.years ?? []);
  const out: Holiday[] = [];
  for (const y of years) {
    if (have.has(y)) out.push(...official!.holidays.filter((h) => h.date.startsWith(`${y}-`)));
    else out.push(...englandAndWales(y));
  }
  return out;
}
