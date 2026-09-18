/**
 * Bounded connection pool over `node-sqlite3-wasm`.
 *
 * The database is read-only at runtime -- membership applications are
 * emailed (see `src/lib/email/membership.ts`) instead of written to SQLite --
 * so there is no writer connection any more, only pooled readers.
 *
 * Each `new Database()` call spins up its own WASM instance, which is
 * comparatively heavy, so we cap the reader pool at a small, fixed size and
 * reuse those connections for the app's lifetime.
 *
 * `next build` forks several worker processes to prerender pages, and each
 * one warms up its own pool. Even with every connection read-only and
 * `busy_timeout` set, multiple *processes* opening handles against the same
 * `data/sgsm.db` file still hit `node-sqlite3-wasm`'s VFS locking hard enough
 * to occasionally fail with "database is locked" / "disk I/O error" (see
 * `warmUp()` below). Since nothing writes to the database any more, each
 * process instead gets its own private copy in the OS temp directory --
 * 335KB is negligible to duplicate -- which removes cross-process file
 * contention entirely rather than just tolerating it with a timeout.
 *
 * Next.js's dev server reloads route modules on every change, which would
 * normally re-run this module and open a fresh set of connections each time.
 * To avoid leaking WASM instances across reloads, the pool state is cached
 * on `globalThis`.
 *
 * Temp-copy cleanup is two layers deep (see `registerExitHookOnce()` and
 * `sweepOrphanedTempDbs()`) because `next build` worker processes are not
 * always given a chance to run their own shutdown code before they're torn
 * down.
 */
import { Database } from "node-sqlite3-wasm";
import { randomUUID } from "node:crypto";
import { copyFileSync, existsSync, readdirSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

// Matches the temp-copy filenames this module creates (see
// `preparePerProcessCopy()`), capturing the owning PID so
// `sweepOrphanedTempDbs()` can tell a live copy from an abandoned one.
const TEMP_DB_NAME_PATTERN = /^sgsm-(\d+)-[0-9a-f-]+\.db$/;

// `node-sqlite3-wasm` calls are all synchronous and Node.js itself is
// single-threaded, so a pool of multiple reader connections in one process
// buys zero read parallelism -- concurrent `acquireReader()` calls within a
// process just queue up on the FIFO waiter list and run one at a time
// regardless of how many connections exist. What multiple readers per
// process *does* buy is more open file handles against the database file,
// so keeping it at 1 reader per process minimizes open handles while
// sacrificing nothing.
const MAX_READERS = 1;

const DB_PATH = process.env.SGSM_DB_PATH ?? path.join(process.cwd(), "data", "sgsm.db");

// How long a connection will wait on a lock before giving up with "database
// is locked". Belt-and-braces: now that each process opens its own private
// copy of the database (see `warmUp()`), cross-process contention on a
// shared file is designed out entirely, but this stays as a cheap defense
// against any remaining contention (e.g. the fallback path below, or a
// second connection within the same process).
const BUSY_TIMEOUT_MS = 8000;

/**
 * Applies the pragmas every reader connection must have before it is handed
 * out. Currently just `busy_timeout`.
 */
function configureConnection(db: Database): void {
  db.exec(`PRAGMA busy_timeout = ${BUSY_TIMEOUT_MS};`);
}

type ReaderWaiter = (db: Database) => void;

interface PoolState {
  readers: Database[];
  available: Database[];
  waiters: ReaderWaiter[];
  warmed: boolean;
  /** Path of this process's private copy of the database, if one was made. */
  tempDbPath: string | null;
  /** Whether the `process.on("exit")` cleanup hook has been registered. */
  exitHookRegistered: boolean;
}

const globalForPool = globalThis as unknown as {
  __sgsmDbPool?: PoolState;
};

function createPoolState(): PoolState {
  return {
    readers: [],
    available: [],
    waiters: [],
    warmed: false,
    tempDbPath: null,
    exitHookRegistered: false,
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

/**
 * Closes every open reader connection, synchronously. Safe to call from a
 * `process.on("exit")` handler, where only synchronous work is possible.
 */
function closeReadersSync(): void {
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
  state.warmed = false;
}

/**
 * Best-effort removal of this process's private database copy, if any. The
 * connection(s) against it must already be closed -- on Windows in
 * particular, `node-sqlite3-wasm` holds an OS file handle on the copy for as
 * long as the `Database` is open, and an open handle blocks deletion, so
 * calling this before `closeReadersSync()` would silently no-op.
 */
function cleanupTempDb(): void {
  if (!state.tempDbPath) return;
  try {
    rmSync(state.tempDbPath, { force: true });
  } catch {
    // best effort -- OS temp dirs get swept eventually regardless
  }
  state.tempDbPath = null;
}

/** True if `pid` currently identifies a running process. */
function isProcessRunning(pid: number): boolean {
  try {
    // Signal 0 sends nothing; it only probes whether the process exists and
    // is one we could signal.
    process.kill(pid, 0);
    return true;
  } catch (err) {
    // EPERM means the process exists but we lack permission to signal it --
    // still running. Anything else (ESRCH, ...) means it's gone.
    return (err as NodeJS.ErrnoException).code === "EPERM";
  }
}

/**
 * Deletes per-process database copies left behind by processes that no
 * longer exist. `next build`'s worker processes are sometimes torn down by
 * a signal or force-kill that gives this module's own `process.on("exit")` /
 * signal handlers no chance to run (observed: with only those handlers,
 * temp copies from every build worker were still left behind), so exit-time
 * cleanup alone isn't reliable. This sweep runs at the start of every
 * `warmUp()` in every process (the next build worker, `next start`, the
 * seed/verify scripts, ...) and mops up whatever the previous occupant
 * couldn't, so orphaned copies don't accumulate indefinitely. It never
 * touches this process's own file or one whose owning PID is still alive.
 */
function sweepOrphanedTempDbs(): void {
  let entries: string[];
  try {
    entries = readdirSync(os.tmpdir());
  } catch {
    return;
  }
  for (const name of entries) {
    const match = TEMP_DB_NAME_PATTERN.exec(name);
    if (!match) continue;
    const pid = Number(match[1]);
    if (pid === process.pid) continue;
    if (isProcessRunning(pid)) continue;
    try {
      rmSync(path.join(os.tmpdir(), name), { force: true });
    } catch {
      // another process may already be cleaning up the same file, or it's
      // still briefly locked -- harmless, the next sweep will catch it
    }
  }
}

/**
 * Ensures build workers and serverless functions don't leave per-process
 * database copies behind in the OS temp directory. Registered at most once
 * per process (state survives dev-server hot reloads on `globalThis`, so a
 * naive `process.on` here would otherwise add a new listener on every
 * reload).
 *
 * Two layers, because `next build` can tear its worker processes down
 * without giving app code a chance to run a shutdown path at all:
 *  - `exit` plus the common termination signals cover graceful shutdown
 *    (`next start`/`next dev` stopped normally, a worker that finishes and
 *    exits on its own). Cleanup here must be synchronous (`close()` +
 *    `rmSync()`), since `exit` handlers can't await anything.
 *  - `sweepOrphanedTempDbs()` (called from `warmUp()`) is the backstop for
 *    workers that get force-killed with no chance to run any handler --
 *    the next process to start cleans up after them instead.
 */
function registerExitHookOnce(): void {
  if (state.exitHookRegistered) return;
  state.exitHookRegistered = true;
  const cleanup = () => {
    closeReadersSync();
    cleanupTempDb();
  };
  process.on("exit", cleanup);
  // Signals need their own listener: Node's `exit` event does not fire when
  // the default disposition of an unhandled signal is what terminates the
  // process. Re-exiting after cleanup preserves normal shutdown semantics
  // for whatever supervises this process (Next's CLI, a process manager, a
  // terminal's Ctrl+C).
  for (const signal of ["SIGINT", "SIGTERM", "SIGHUP", "SIGBREAK"] as const) {
    process.on(signal, () => {
      cleanup();
      process.exit(0);
    });
  }
}

/**
 * Copies `DB_PATH` into a per-process file in the OS temp directory (`/tmp`
 * on Vercel, where it's the only writable location) and returns its path.
 * Falls back to `DB_PATH` itself if the copy fails for any reason -- e.g. a
 * restricted temp dir -- logging a warning rather than crashing, since the
 * shared-file path plus `busy_timeout` is still functional, just not as
 * contention-free.
 *
 * This is what eliminates the "database is locked" / "disk I/O error"
 * flakiness during `next build`: each of the several worker processes that
 * `next build` forks to prerender pages gets its own private ~335KB copy of
 * the (read-only) database, so there is no longer a file that multiple
 * processes open concurrently at all.
 */
function preparePerProcessCopy(): string {
  registerExitHookOnce();
  sweepOrphanedTempDbs();
  const tempPath = path.join(os.tmpdir(), `sgsm-${process.pid}-${randomUUID()}.db`);
  try {
    copyFileSync(DB_PATH, tempPath);
    state.tempDbPath = tempPath;
    return tempPath;
  } catch (err) {
    console.warn(
      `[db] Failed to create a per-process copy of "${DB_PATH}" at "${tempPath}"; ` +
        "falling back to opening the shared database file directly. This risks " +
        "cross-process lock contention under concurrent build workers.",
      err instanceof Error ? err.message : err
    );
    state.tempDbPath = null;
    return DB_PATH;
  }
}

/** Lazily opens the reader connections on first use. */
function warmUp(): void {
  if (state.warmed) return;
  assertDbFileExists();
  const readerDbPath = preparePerProcessCopy();
  for (let i = 0; i < MAX_READERS; i++) {
    // `fileMustExist: true` means a missing DB fails fast with a clear
    // error instead of silently creating an empty file.
    const db = new Database(readerDbPath, { fileMustExist: true });
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

/**
 * Closes every pooled connection and removes this process's private
 * database copy, if one was made. Call on graceful shutdown.
 */
export function closeAll(): void {
  closeReadersSync();
  cleanupTempDb();
}

export const dbPath = DB_PATH;
export const maxReaders = MAX_READERS;
