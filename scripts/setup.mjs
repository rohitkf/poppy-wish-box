#!/usr/bin/env node
// Applies db/schema.sql and creates your shared space if there isn't one yet.
// Safe to run again: the schema is idempotent and an existing space is kept.
//   Production deploys on Vercel run it automatically (`npm run build` calls it with --on-build,
//   after a successful build).
//   The Docker image runs it on start, before the server.
//   Locally: DATABASE_URL=... npm run setup
import { readFileSync } from "node:fs";
import pg from "pg";

if (process.argv.includes("--on-build") && process.env.VERCEL_ENV !== "production") {
  console.log(`Database setup skipped (VERCEL_ENV=${process.env.VERCEL_ENV ?? "unset"}): only production builds on Vercel run it.`);
  process.exit(0);
}

// pg treats sslmode=require as verify-full already; saying so avoids its warning (as lib/db.ts does,
// which also leaves uselibpqcompat=true URLs alone).
const rawUrl = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
const url = rawUrl && !/[?&]uselibpqcompat=true(?=&|$)/i.test(rawUrl)
  ? rawUrl.replace(/([?&]sslmode=)(?:prefer|require|verify-ca)(?=&|$)/, "$1verify-full")
  : rawUrl;
if (!url) {
  console.error("Set DATABASE_URL first (connect Neon in Vercel → Storage; locally: vercel env pull .env.local)");
  process.exit(1);
}

// A container can start before its database accepts connections: retry for about a minute.
let client;
for (let attempt = 1; ; attempt++) {
  client = new pg.Client({ connectionString: url, connectionTimeoutMillis: 10_000 });
  try {
    await client.connect();
    break;
  } catch (e) {
    await client.end().catch(() => {});
    if (attempt >= 12) throw e;
    console.log(`Database not reachable yet (${e.code ?? e.message}); retrying…`);
    await new Promise((r) => setTimeout(r, 5000));
  }
}
try {
  // Several containers (or overlapping builds) may start at once: take turns, so only
  // one of them creates the space. The lock ends with the connection.
  await client.query("select pg_advisory_lock(hashtext('ours:setup'))");
  // Don't queue behind a long query while holding up the app's own queries; a retry will do.
  await client.query("set lock_timeout = '10s'");
  await client.query(readFileSync(new URL("../db/schema.sql", import.meta.url), "utf8"));
  // Old per-network unlock counters are only clutter.
  await client.query(
    "delete from unlock_attempts where ip <> '*' and updated_at < now() - interval '1 day' and (locked_until is null or locked_until < now())",
  );
  const { rows } = await client.query("select id from spaces order by created_at limit 1");
  if (rows[0]) {
    console.log("Schema up to date. Your space is already set up.");
  } else {
    const { rows: created } = await client.query("insert into spaces (name) values ('Ours') returning id");
    const spaceId = created[0].id;
    const starters = [
      ["Places to go", "icon:pin", "clay"],
      ["To buy", "icon:bag", "teal"],
      ["Date ideas", "icon:heart", "plum"],
    ];
    for (const [i, [name, emoji, color]] of starters.entries()) {
      await client.query("insert into lists (space_id, name, emoji, color, position) values ($1, $2, $3, $4, $5)", [
        spaceId,
        name,
        emoji,
        color,
        i + 1,
      ]);
    }
    console.log("Schema applied. Space created with three starter lists.");
  }
} finally {
  await client.end();
}
