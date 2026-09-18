#!/usr/bin/env node
/**
 * Asserts that every hot query in src/lib/db/queries.ts has an
 * `EXPLAIN QUERY PLAN` free of full-table scans. A "full-table scan" here
 * means a plan row whose detail starts with SCAN and does NOT also say
 * "USING INDEX" / "USING COVERING INDEX" -- i.e. SQLite had to walk every
 * row of a table with no index to help it. An index-assisted SCAN (e.g. to
 * satisfy an ORDER BY without a WHERE clause) is fine; that is what the
 * indexes in schema.sql are for.
 *
 * Exits 0 and prints every checked query's plan when all pass; exits 1 and
 * prints which query violated the rule otherwise.
 *
 * Run with `node scripts/db-verify.mjs` (or `npm run db:verify`) AFTER
 * `node scripts/seed-db.mjs` -- it opens the already-seeded data/sgsm.db
 * read-only.
 */
import sqlite3wasm from "node-sqlite3-wasm";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const { Database } = sqlite3wasm;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const DB_PATH = process.env.SGSM_DB_PATH ?? path.join(ROOT, "data", "sgsm.db");

const TODAY = `${new Date().toISOString().slice(0, 10)}T00:00:00`;

/**
 * Every entry mirrors a real query issued by src/lib/db/queries.ts, with
 * representative bound parameters. `sql` and `params` here are kept in sync
 * with that file by hand -- if you change a query's shape there, update it
 * here too.
 */
const HOT_QUERIES = [
  {
    name: "listEvents({ when: 'upcoming' }) -- rows",
    sql: `
      SELECT
        e.id, e.slug, e.title, e.start_date, e.end_date, e.all_day, e.cost, e.website,
        e.image_json, e.excerpt,
        v.slug AS venue_slug, v.name AS venue_name, v.city AS venue_city,
        v.province AS venue_province, v.country AS venue_country, v.map_query AS venue_map_query,
        (SELECT GROUP_CONCAT(category) FROM event_categories WHERE event_id = e.id) AS categories_csv
      FROM events e
      LEFT JOIN venues v ON v.id = e.venue_id
      WHERE e.start_date >= ?
      ORDER BY e.start_date ASC
      LIMIT ? OFFSET ?
    `,
    params: [TODAY, 12, 0],
  },
  {
    name: "listEvents({ category }) -- rows",
    sql: `
      SELECT
        e.id, e.slug, e.title, e.start_date, e.end_date, e.all_day, e.cost, e.website,
        e.image_json, e.excerpt,
        v.slug AS venue_slug, v.name AS venue_name, v.city AS venue_city,
        v.province AS venue_province, v.country AS venue_country, v.map_query AS venue_map_query,
        (SELECT GROUP_CONCAT(category) FROM event_categories WHERE event_id = e.id) AS categories_csv
      FROM events e
      JOIN event_categories ec ON ec.event_id = e.id AND ec.category = ?
      LEFT JOIN venues v ON v.id = e.venue_id
      ORDER BY e.start_date ASC
      LIMIT ? OFFSET ?
    `,
    params: ["event", 12, 0],
  },
  {
    name: "listEvents({ when: 'all' }) -- unfiltered rows (index-assisted order)",
    sql: `
      SELECT e.id, e.slug FROM events e
      LEFT JOIN venues v ON v.id = e.venue_id
      ORDER BY e.start_date ASC
      LIMIT ? OFFSET ?
    `,
    params: [12, 0],
  },
  {
    name: "countEvents({ when: 'upcoming' })",
    sql: `SELECT COUNT(*) AS total FROM events e LEFT JOIN venues v ON v.id = e.venue_id WHERE e.start_date >= ?`,
    params: [TODAY],
  },
  {
    name: "getEventBySlug",
    sql: `
      SELECT e.*, v.slug AS venue_slug
      FROM events e LEFT JOIN venues v ON v.id = e.venue_id
      WHERE e.slug = ?
    `,
    params: ["6th-indonesian-senior-open"],
  },
  {
    name: "listEventCategories facet",
    sql: `SELECT category, COUNT(*) AS count FROM event_categories GROUP BY category ORDER BY category ASC`,
    params: [],
  },
  {
    name: "listNews({ category }) -- rows",
    sql: `SELECT id, slug, title, date, excerpt, category, image_json FROM news WHERE category = ? ORDER BY date DESC LIMIT ? OFFSET ?`,
    params: ["news", 12, 0],
  },
  {
    name: "listNews({}) -- unfiltered rows (index-assisted order)",
    sql: `SELECT id, slug FROM news ORDER BY date DESC LIMIT ? OFFSET ?`,
    params: [12, 0],
  },
  {
    name: "countNews({ category })",
    sql: `SELECT COUNT(*) AS total FROM news WHERE category = ?`,
    params: ["news"],
  },
  {
    name: "getNewsBySlug",
    sql: `SELECT * FROM news WHERE slug = ?`,
    params: ["the-mines-resort-country-club"],
  },
  {
    name: "listNewsCategories facet",
    sql: `SELECT category, COUNT(*) AS count FROM news GROUP BY category ORDER BY category ASC`,
    params: [],
  },
  {
    name: "listAlbums -- rows with GROUP BY image count",
    sql: `
      SELECT a.id, a.slug, a.title, a.date, a.cover_json, COUNT(gi.id) AS image_count
      FROM gallery_albums a INDEXED BY idx_gallery_albums_date
      LEFT JOIN gallery_images gi ON gi.album_id = a.id
      GROUP BY a.id
      ORDER BY a.date DESC, a.title ASC
      LIMIT ? OFFSET ?
    `,
    params: [12, 0],
  },
  {
    name: "getAlbumBySlug -- meta",
    sql: `SELECT id, slug, title, date, cover_json FROM gallery_albums WHERE slug = ?`,
    params: ["hari-malaysia-golf-challenge-22-september-2022-glenmarie-golf-and-country-club"],
  },
  {
    name: "getAlbumBySlug -- images page (with running total)",
    sql: `
      SELECT id, src, alt, width, height, caption, COUNT(*) OVER() AS total_count
      FROM gallery_images WHERE album_id = ? ORDER BY sort_order ASC LIMIT ? OFFSET ?
    `,
    params: [1, 12, 0],
  },
  {
    name: "listDownloads({ category }) -- rows",
    sql: `SELECT id, title, category, description, file_src, file_ext, file_size, updated FROM downloads INDEXED BY idx_downloads_category WHERE category = ? ORDER BY updated DESC, title ASC LIMIT ? OFFSET ?`,
    params: ["Downloads", 12, 0],
  },
  {
    name: "countDownloads({ category })",
    sql: `SELECT COUNT(*) AS total FROM downloads INDEXED BY idx_downloads_category WHERE category = ?`,
    params: ["Downloads"],
  },
];

function isBareTableScan(detail) {
  if (typeof detail !== "string") return false;
  const trimmed = detail.trim();
  // "SCAN (subquery-N)" / "SCAN SUBQUERY N" walk an ephemeral, already
  // materialized result set (e.g. the row set a window function like
  // `COUNT(*) OVER()` produced) -- there is no table or index to speak of,
  // so it is not the full-table-scan-on-real-data problem this check exists
  // to catch. Only a scan naming an actual table/alias counts.
  if (!/^SCAN\s+(?!\()\S/i.test(trimmed)) return false;
  return !/USING (COVERING )?INDEX/i.test(trimmed);
}

function main() {
  if (!existsSync(DB_PATH)) {
    console.error(`No database found at ${DB_PATH}. Run "node scripts/seed-db.mjs" first.`);
    process.exit(1);
  }

  const db = new Database(DB_PATH, { readOnly: true, fileMustExist: true });
  let failures = 0;

  try {
    for (const query of HOT_QUERIES) {
      const plan = db.all(`EXPLAIN QUERY PLAN ${query.sql}`, query.params);
      console.log(`\n-- ${query.name}`);
      const violations = [];
      for (const row of plan) {
        const detail = row.detail;
        console.log(`   ${detail}`);
        if (isBareTableScan(detail)) {
          violations.push(detail);
        }
      }
      if (violations.length > 0) {
        failures++;
        console.error(`   FAIL: full-table scan detected -> ${violations.join(" | ")}`);
      } else {
        console.log("   OK: no full-table scan");
      }
    }
  } finally {
    db.close();
  }

  console.log(`\n${HOT_QUERIES.length - failures}/${HOT_QUERIES.length} hot queries passed.`);

  if (failures > 0) {
    console.error(`\ndb-verify FAILED: ${failures} quer${failures === 1 ? "y" : "ies"} had a full-table scan.`);
    process.exit(1);
  }

  console.log("\ndb-verify PASSED: no full-table scans on any hot query.");
}

main();
