/**
 * Thin helpers on top of the pool (`./pool`) that guarantee reader
 * connections are always released and apply the writer's one-time pragma
 * setup. `src/lib/db/queries.ts` is the only module that should import this
 * file directly.
 */
import type { Database } from "node-sqlite3-wasm";
import { acquireReader, getWriter, release } from "./pool";

let writerPragmaState: "pending" | "applied" | "unsupported" = "pending";

/**
 * Applies `PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL;` to the writer
 * connection once. WAL lets readers keep reading while the writer commits a
 * membership application; NORMAL synchronous trades a little durability for
 * write throughput, which is an acceptable tradeoff for this workload.
 *
 * The wasm build's VFS does not always support every pragma a native SQLite
 * build would (WAL in particular depends on shared-memory file support in
 * the VFS). If `exec` throws, we catch it, note it once, and continue with
 * whatever the default journal mode is -- correctness doesn't depend on WAL,
 * only write concurrency does.
 */
function ensureWriterPragmas(db: Database): void {
  if (writerPragmaState !== "pending") return;
  try {
    db.exec("PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL;");
    writerPragmaState = "applied";
  } catch (err) {
    writerPragmaState = "unsupported";
    console.warn(
      "[db] node-sqlite3-wasm driver rejected WAL/synchronous pragmas; " +
        "continuing with the default journal mode.",
      err instanceof Error ? err.message : err
    );
  }
}

/** Returns whether the WAL/synchronous pragmas were successfully applied. */
export function writerPragmaStatus(): "pending" | "applied" | "unsupported" {
  return writerPragmaState;
}

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

/**
 * Runs `fn` against the single writer connection. There is nothing to
 * "release" (the writer is a long-lived singleton), but the pragma setup is
 * applied lazily on first use here so it happens exactly once.
 */
export function withWriter<T>(fn: (db: Database) => T): T {
  const db = getWriter();
  ensureWriterPragmas(db);
  return fn(db);
}
