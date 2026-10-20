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

/** Shared connection settings: fail fast instead of hanging, and keep idle sockets alive. */
export const connectionOptions = {
  connectionTimeoutMillis: 10_000, // long enough for a suspended Neon compute to wake
  keepAlive: true,
  keepAliveInitialDelayMillis: 10_000,
};

export function db() {
  if (!globalForPool.oursPool) {
    const pool = new Pool({
      ...connectionOptions,
      connectionString: connectionString(),
      max: Number(process.env.PG_POOL_MAX) || 5,
      idleTimeoutMillis: 5000,
      statement_timeout: 15_000,
      query_timeout: 15_000,
    });
    // An idle client can drop (network blip, Neon suspending). Without a listener,
    // pg re-emits that as an unhandled 'error' and the whole process exits.
    pool.on("error", (e) => console.error("Postgres idle client error:", e.message));
    attachDatabasePool(pool);
    globalForPool.oursPool = pool;
  }
  return globalForPool.oursPool;
}

/** Direct (non-pooled) connection string — needed for LISTEN. */
export const listenConnectionString = () => connectionString(true);

/** True for errors worth retrying later: the database is unreachable, restarting or overloaded. */
export function isTransientDbError(e: unknown) {
  const code = (e as { code?: unknown })?.code;
  if (typeof code !== "string") return /timeout|terminated|Connection/i.test((e as Error)?.message ?? "");
  return (
    ["ECONNREFUSED", "ECONNRESET", "ETIMEDOUT", "ENOTFOUND", "EAI_AGAIN", "57P01", "57P03", "53300"].includes(code) ||
    code.startsWith("08")
  );
}
