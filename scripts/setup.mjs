#!/usr/bin/env node
// Applies db/schema.sql and creates your shared space if there isn't one yet.
// Safe to run again: the schema is idempotent and an existing space is kept.
//   Production deploys on Vercel run it automatically (`npm run build` calls it with --on-build).
//   Locally: DATABASE_URL=... npm run setup
import { readFileSync } from "node:fs";
import pg from "pg";

if (process.argv.includes("--on-build") && process.env.VERCEL_ENV !== "production") {
  console.log("Database setup skipped: only production builds on Vercel run it.");
  process.exit(0);
}

const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!url) {
  console.error("Set DATABASE_URL first (connect Neon in Vercel → Storage; locally: vercel env pull .env.local)");
  process.exit(1);
}

const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  await client.query(readFileSync(new URL("../db/schema.sql", import.meta.url), "utf8"));
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
