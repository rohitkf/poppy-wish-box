import "server-only";
import { Pool, types } from "pg";
import { attachDatabasePool } from "@vercel/functions";

// numeric → number, date → "YYYY-MM-DD" (no timezone shifting).
types.setTypeParser(1700, (v) => (v === null ? null : parseFloat(v)));
types.setTypeParser(1082, (v) => v);

const globalForPool = globalThis as unknown as { oursPool?: Pool };

function connectionString(unpooled = false) {
  const url = unpooled
    ? process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL
    : process.env.DATABASE_URL;
  if (!url) throw new Error("Missing DATABASE_URL (connect a Neon Postgres database in Vercel → Storage)");
  return url;
}

export function db() {
  if (!globalForPool.oursPool) {
    globalForPool.oursPool = new Pool({ connectionString: connectionString(), max: 5, idleTimeoutMillis: 5000 });
    attachDatabasePool(globalForPool.oursPool);
  }
  return globalForPool.oursPool;
}

/** Direct (non-pooled) connection string — needed for LISTEN. */
export const listenConnectionString = () => connectionString(true);
