#!/usr/bin/env node
/**
 * Builds data/sgsm.db from content/*.json.
 *
 * Idempotent and re-runnable: every content-derived table (venues, events,
 * event_categories, news, gallery_albums, gallery_images, downloads) is
 * cleared and re-inserted from the JSON on every run, so running this twice
 * in a row -- or after another worker updates content/gallery.json,
 * content/downloads.json or content/media-manifest.json -- always leaves the
 * database matching the JSON on disk exactly, with no duplicates.
 *
 * `membership_applications` is never touched here: it holds live runtime
 * writes from the /api/membership route, not seeded content.
 *
 * Nothing about this script hardcodes row counts. Albums may have 0 or 200
 * images, events may gain or lose categories, downloads may go from 2 rows
 * to 7 -- the script just reflects whatever is in content/*.json.
 */
import sqlite3wasm from "node-sqlite3-wasm";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const { Database } = sqlite3wasm;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const CONTENT_DIR = path.join(ROOT, "content");
const DATA_DIR = path.join(ROOT, "data");
const DB_PATH = process.env.SGSM_DB_PATH ?? path.join(DATA_DIR, "sgsm.db");
const SCHEMA_PATH = path.join(ROOT, "src", "lib", "db", "schema.sql");

function readJson(relPath) {
  const full = path.join(CONTENT_DIR, relPath);
  return JSON.parse(readFileSync(full, "utf-8"));
}

function toJsonOrNull(value) {
  return value === null || value === undefined ? null : JSON.stringify(value);
}

function main() {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }

  const db = new Database(DB_PATH);
  const schemaSql = readFileSync(SCHEMA_PATH, "utf-8");

  const summary = {};

  try {
    db.exec(schemaSql);

    db.exec("BEGIN TRANSACTION");
    try {
      // Delete children before parents to satisfy FK constraints. Content
      // tables only -- membership_applications is deliberately excluded.
      db.exec("DELETE FROM event_categories");
      db.exec("DELETE FROM gallery_images");
      db.exec("DELETE FROM gallery_albums");
      db.exec("DELETE FROM events");
      db.exec("DELETE FROM venues");
      db.exec("DELETE FROM news");
      db.exec("DELETE FROM downloads");

      summary.venues = seedVenues(db);
      summary.events = seedEvents(db);
      summary.news = seedNews(db);
      summary.galleryAlbums = seedGallery(db);
      summary.downloads = seedDownloads(db);

      db.exec("COMMIT");
    } catch (err) {
      if (db.inTransaction) db.exec("ROLLBACK");
      throw err;
    }

    // Refresh the query planner's statistics now that the tables are full.
    db.exec("ANALYZE");
  } finally {
    db.close();
  }

  console.log(`Seeded database at ${DB_PATH}`);
  for (const [table, count] of Object.entries(summary)) {
    console.log(`  ${table}: ${count}`);
  }
}

function seedVenues(db) {
  const venues = readJson("venues.json");
  const stmt = db.prepare(
    `INSERT INTO venues (id, slug, name, address, city, province, zip, country, map_query)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  try {
    for (const venue of venues) {
      stmt.run([
        venue.id,
        venue.slug,
        venue.name,
        venue.address ?? null,
        venue.city ?? null,
        venue.province ?? null,
        venue.zip ?? null,
        venue.country ?? null,
        venue.mapQuery ?? null,
      ]);
    }
  } finally {
    stmt.finalize();
  }
  return venues.length;
}

function seedEvents(db) {
  const events = readJson("events.json");
  const venues = readJson("venues.json");
  const venueIdBySlug = new Map(venues.map((v) => [v.slug, v.id]));

  const eventStmt = db.prepare(
    `INSERT INTO events (id, slug, title, start_date, end_date, all_day, cost, website, image_json, venue_id, excerpt, blocks_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const categoryStmt = db.prepare(`INSERT INTO event_categories (event_id, category) VALUES (?, ?)`);

  try {
    for (const event of events) {
      const venueId = event.venueSlug ? (venueIdBySlug.get(event.venueSlug) ?? null) : null;
      eventStmt.run([
        event.id,
        event.slug,
        event.title,
        event.startDate,
        event.endDate,
        event.allDay ? 1 : 0,
        event.cost ?? null,
        event.website ?? null,
        toJsonOrNull(event.image ?? null),
        venueId,
        event.excerpt ?? null,
        toJsonOrNull(event.blocks ?? []),
      ]);

      for (const category of event.categories ?? []) {
        categoryStmt.run([event.id, category]);
      }
    }
  } finally {
    eventStmt.finalize();
    categoryStmt.finalize();
  }
  return events.length;
}

function seedNews(db) {
  const posts = readJson("news.json");
  const stmt = db.prepare(
    `INSERT INTO news (id, slug, title, date, excerpt, category, image_json, blocks_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );
  try {
    for (const post of posts) {
      stmt.run([
        post.id,
        post.slug,
        post.title,
        post.date,
        post.excerpt ?? null,
        post.category,
        toJsonOrNull(post.image ?? null),
        toJsonOrNull(post.blocks ?? []),
      ]);
    }
  } finally {
    stmt.finalize();
  }
  return posts.length;
}

function seedGallery(db) {
  const { albums } = readJson("gallery.json");
  const albumStmt = db.prepare(
    `INSERT INTO gallery_albums (slug, title, date, cover_json) VALUES (?, ?, ?, ?)`
  );
  const imageStmt = db.prepare(
    `INSERT INTO gallery_images (album_id, src, alt, width, height, caption, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );

  try {
    for (const album of albums) {
      const result = albumStmt.run([
        album.slug,
        album.title,
        album.date ?? null,
        toJsonOrNull(album.cover ?? null),
      ]);
      const albumId = result.lastInsertRowid;

      const images = album.images ?? [];
      images.forEach((image, index) => {
        imageStmt.run([
          albumId,
          image.src,
          image.alt ?? null,
          image.width ?? null,
          image.height ?? null,
          image.caption ?? null,
          index,
        ]);
      });
    }
  } finally {
    albumStmt.finalize();
    imageStmt.finalize();
  }
  return albums.length;
}

function seedDownloads(db) {
  const downloads = readJson("downloads.json");
  const stmt = db.prepare(
    `INSERT INTO downloads (id, title, category, description, file_src, file_ext, file_size, updated)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );
  try {
    for (const download of downloads) {
      stmt.run([
        download.id,
        download.title,
        download.category ?? null,
        download.description ?? null,
        download.file.src,
        download.file.ext ?? null,
        download.file.sizeBytes ?? null,
        download.updated ?? null,
      ]);
    }
  } finally {
    stmt.finalize();
  }
  return downloads.length;
}

main();
