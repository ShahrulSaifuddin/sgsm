/**
 * Thin helper on top of the pool (`./pool`) that guarantees reader
 * connections are always released. `src/lib/db/queries.ts` is the only
 * module that should import this file directly.
 *
 * The database is read-only at runtime -- membership applications are
 * emailed (see `src/lib/email/membership.ts`) rather than written to SQLite
 * -- so there is no writer connection or write-side pragma setup here any
 * more; `getWriter`/`withWriter` were removed from `./pool` as dead code
 * once nothing called them.
 */
import type { Database } from "node-sqlite3-wasm";
import { acquireReader, release } from "./pool";

/**
 * Runs `fn` against a pooled reader connection and always releases it back
 * to the pool, even if `fn` throws.
 */
export async function withReader<T>(fn: (db: Database) => T): Promise<T> {
  const db = await acquireReader();
  try {
    return fn(db);
  } finally {
    release(db);
  }
}
