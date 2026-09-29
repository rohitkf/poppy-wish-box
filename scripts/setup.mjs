#!/usr/bin/env node
// One-time setup: applies db/schema.sql and creates your private space.
//   DATABASE_URL=... npm run setup -- "a long shared passphrase"
// Run again with a new passphrase to change it (the existing space is kept).
import { readFileSync } from "node:fs";
import pg from "pg";
import bcrypt from "bcryptjs";

const pass = process.argv.slice(2).join(" ").trim();
if (pass.length < 12) {
  console.error('Give a passphrase of at least 12 characters:\n  npm run setup -- "summer in skye 2027"');
  process.exit(1);
}
const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!url) {
  console.error("Set DATABASE_URL first (vercel env pull .env.local, then: node --env-file=.env.local scripts/setup.mjs ...)");
  process.exit(1);
}

const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  await client.query(readFileSync(new URL("../db/schema.sql", import.meta.url), "utf8"));
  const hash = bcrypt.hashSync(pass, 12);
  const { rows } = await client.query("select id from spaces order by created_at limit 1");
  if (rows[0]) {
    await client.query("update spaces set passcode_hash = $1 where id = $2", [hash, rows[0].id]);
    console.log("Schema up to date. Passcode changed for your existing space.");
  } else {
    const { rows: created } = await client.query(
      "insert into spaces (name, passcode_hash) values ('Ours', $1) returning id",
      [hash],
    );
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
    console.log("Schema applied. Space created with three starter lists. Share the passphrase with your partner.");
  }
} finally {
  await client.end();
}
