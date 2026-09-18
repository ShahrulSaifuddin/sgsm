/**
 * Bounded connection pool over `node-sqlite3-wasm`.
 *
 * Each `new Database()` call spins up its own WASM instance, which is
 * comparatively heavy, so we cap the reader pool at a small, fixed size and
 * reuse those connections for the app's lifetime. Writes (rare: membership
 * applications) go through a single dedicated writer connection instead of
 * the pool, since SQLite only ever wants one writer at a time and every call
 * into node-sqlite3-wasm is synchronous, so there is no risk of interleaved
 * writes within a single Node.js process.
 *
 * Next.js's dev server reloads route modules on every change, which would
 * normally re-run this module and open a fresh set of connections each time.
 * To avoid leaking WASM instances across reloads, the pool state is cached
 * on `globalThis`.
 */
import { Database } from "node-sqlite3-wasm";
import { existsSync } from "node:fs";
import path from "node:path";

// `node-sqlite3-wasm` calls are all synchronous and Node.js itself is
// single-threaded, so a pool of multiple reader connections in one process
// buys zero read parallelism -- concurrent `acquireReader()` calls within a
// process just queue up on the FIFO waiter list and run one at a time
// regardless of how many connections exist. What multiple readers per
// process *does* buy is more open file handles against `data/sgsm.db`, and
// during `next build` many worker processes are opened at once, each
// warming up its own pool -- so MAX_READERS multiplies straight into
// cross-process lock contention with no upside. Dropping it to 1 reader per
// process minimizes that contention while sacrificing nothing (see the
// build result in the pool.ts change notes / task report for confirmation
// this is sufficient).
const MAX_READERS = 1;

const DB_PATH = process.env.SGSM_DB_PATH ?? path.join(process.cwd(), "data", "sgsm.db");

// How long a connection will wait on a lock held by another connection
// (reader or writer, in this or another process) before giving up with
// "database is locked". Static generation forks several worker processes
// that each open connections to the same `data/sgsm.db` file concurrently;
// without this, node-sqlite3-wasm's VFS returns SQLITE_BUSY immediately on
// any contention instead of retrying, which is what broke `npm run build`.
const BUSY_TIMEOUT_MS = 8000;

/**
 * Applies the pragmas every connection -- reader or writer -- must have
 * before it is handed out. Currently just `busy_timeout`; kept as a helper
 * so readers and the writer can't drift out of sync on this.
 */
function configureConnection(db: Database): void {
  db.exec(`PRAGMA busy_timeout = ${BUSY_TIMEOUT_MS};`);
}

type ReaderWaiter = (db: Database) => void;

interface PoolState {
  readers: Database[];
  available: Database[];
  waiters: ReaderWaiter[];
  writer: Database | null;
  warmed: boolean;
}

const globalForPool = globalThis as unknown as {
  __sgsmDbPool?: PoolState;
};

function createPoolState(): PoolState {
  return {
    readers: [],
    available: [],
    waiters: [],
    writer: null,
    warmed: false,
  };
}

const state: PoolState = globalForPool.__sgsmDbPool ?? (globalForPool.__sgsmDbPool = createPoolState());

function assertDbFileExists(): void {
  if (!existsSync(DB_PATH)) {
    throw new Error(
      `SQLite database not found at "${DB_PATH}". Run "npm run seed" (node scripts/seed-db.mjs) before starting the app.`
    );
  }
}

/** Lazily opens the reader connections on first use. */
function warmUp(): void {
  if (state.warmed) return;
  assertDbFileExists();
  for (let i = 0; i < MAX_READERS; i++) {
    // Deliberately NOT `{ readOnly: true }`. Empirically (6 concurrent
    // processes hammering the real data/sgsm.db), read-only handles on this
    // driver were just as prone to "database is locked" as read-write ones
    // when no busy_timeout was set, and adding busy_timeout to a read-only
    // handle still left 1/6 runs failing with a "disk I/O error" -- only
    // read-write connections + busy_timeout got 6/6. `fileMustExist: true`
    // is kept so a missing DB still fails fast with a clear error instead of
    // silently creating an empty file. Do not add `readOnly: true` back
    // without re-running that concurrency test.
    const db = new Database(DB_PATH, { fileMustExist: true });
    configureConnection(db);
    state.readers.push(db);
    state.available.push(db);
  }
  state.warmed = true;
}

/**
 * Acquires a reader connection from the pool, waiting in a small FIFO queue
 * if all `MAX_READERS` connections are currently checked out.
 */
export function acquireReader(): Promise<Database> {
  warmUp();
  const db = state.available.pop();
  if (db) return Promise.resolve(db);
  return new Promise<Database>((resolve) => {
    state.waiters.push(resolve);
  });
}

/** Returns a reader connection to the pool (or hands it to the next waiter). */
export function release(db: Database): void {
  const nextWaiter = state.waiters.shift();
  if (nextWaiter) {
    nextWaiter(db);
    return;
  }
  if (!state.available.includes(db)) {
    state.available.push(db);
  }
}

/** Returns the single, lazily-opened writer connection. */
export function getWriter(): Database {
  if (!state.writer) {
    assertDbFileExists();
    state.writer = new Database(DB_PATH);
    configureConnection(state.writer);
  }
  return state.writer;
}

/** Closes every pooled connection. Call on graceful shutdown. */
export function closeAll(): void {
  for (const db of state.readers) {
    try {
      db.close();
    } catch {
      // already closed / nothing to do
    }
  }
  state.readers = [];
  state.available = [];
  state.waiters = [];

  if (state.writer) {
    try {
      state.writer.close();
    } catch {
      // already closed / nothing to do
    }
    state.writer = null;
  }

  state.warmed = false;
}

export const dbPath = DB_PATH;
export const maxReaders = MAX_READERS;
