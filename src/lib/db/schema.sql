-- SGSM SQLite schema (src/lib/db/schema.sql)
--
-- Applied idempotently by scripts/seed-db.mjs on every run via
-- `CREATE TABLE IF NOT EXISTS` / `CREATE INDEX IF NOT EXISTS`, so it is safe
-- to execute against an already-seeded database.
--
-- Content tables (venues, events, event_categories, news, gallery_albums,
-- gallery_images, downloads) are fully owned by the seed script: their rows
-- are derived from content/*.json and are dropped + re-inserted on every
-- seed run.
--
-- There is no membership-applications table. Membership applications are
-- emailed to the Society (src/lib/email/membership.ts) rather than written
-- to SQLite, because Vercel's filesystem is read-only and ephemeral -- a row
-- written here would never survive past the request that created it.

PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------------------
-- Venues
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS venues (
  id         INTEGER PRIMARY KEY,
  slug       TEXT NOT NULL UNIQUE,
  name       TEXT NOT NULL,
  address    TEXT,
  city       TEXT,
  province   TEXT,
  zip        TEXT,
  country    TEXT,
  map_query  TEXT
);
-- `slug` already has a UNIQUE index from the constraint above.

-- ---------------------------------------------------------------------------
-- Events
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS events (
  id          INTEGER PRIMARY KEY,
  slug        TEXT NOT NULL UNIQUE,
  title       TEXT NOT NULL,
  start_date  TEXT NOT NULL, -- ISO "YYYY-MM-DDTHH:mm:ss", sortable as text
  end_date    TEXT NOT NULL,
  all_day     INTEGER NOT NULL DEFAULT 0, -- 0/1 boolean
  cost        TEXT,
  website     TEXT,
  image_json  TEXT, -- JSON-serialized ImageRef | null
  venue_id    INTEGER REFERENCES venues(id),
  excerpt     TEXT,
  blocks_json TEXT NOT NULL DEFAULT '[]' -- JSON-serialized Block[]
);
-- `slug` already has a UNIQUE index from the constraint above.
CREATE INDEX IF NOT EXISTS idx_events_start_date ON events(start_date);
CREATE INDEX IF NOT EXISTS idx_events_venue_id ON events(venue_id);

CREATE TABLE IF NOT EXISTS event_categories (
  event_id INTEGER NOT NULL REFERENCES events(id),
  category TEXT NOT NULL,
  PRIMARY KEY (event_id, category)
);
CREATE INDEX IF NOT EXISTS idx_event_categories_category ON event_categories(category);

-- ---------------------------------------------------------------------------
-- News
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS news (
  id          INTEGER PRIMARY KEY,
  slug        TEXT NOT NULL UNIQUE,
  title       TEXT NOT NULL,
  date        TEXT NOT NULL, -- "YYYY-MM-DD"
  excerpt     TEXT,
  category    TEXT NOT NULL,
  image_json  TEXT, -- JSON-serialized ImageRef | null
  blocks_json TEXT NOT NULL DEFAULT '[]'
);
-- `slug` already has a UNIQUE index from the constraint above.
CREATE INDEX IF NOT EXISTS idx_news_date ON news(date);
CREATE INDEX IF NOT EXISTS idx_news_category ON news(category);

-- ---------------------------------------------------------------------------
-- Gallery
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS gallery_albums (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  slug       TEXT NOT NULL UNIQUE,
  title      TEXT NOT NULL,
  date       TEXT, -- "YYYY-MM-DD" | NULL
  cover_json TEXT  -- JSON-serialized ImageRef | null
);
-- `slug` already has a UNIQUE index from the constraint above.
-- Not in the mandatory index list, but used by listAlbums()'s ORDER BY;
-- added so that query keeps an index-assisted scan instead of a bare one.
CREATE INDEX IF NOT EXISTS idx_gallery_albums_date ON gallery_albums(date);

CREATE TABLE IF NOT EXISTS gallery_images (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  album_id   INTEGER NOT NULL REFERENCES gallery_albums(id),
  src        TEXT NOT NULL,
  alt        TEXT,
  width      INTEGER,
  height     INTEGER,
  caption    TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_gallery_images_album_sort ON gallery_images(album_id, sort_order);

-- ---------------------------------------------------------------------------
-- Downloads
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS downloads (
  id          INTEGER PRIMARY KEY,
  title       TEXT NOT NULL,
  category    TEXT,
  description TEXT,
  file_src    TEXT NOT NULL,
  file_ext    TEXT,
  file_size   INTEGER,
  updated     TEXT -- "YYYY-MM-DD"
);
CREATE INDEX IF NOT EXISTS idx_downloads_category ON downloads(category);
