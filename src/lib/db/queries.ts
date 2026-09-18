/**
 * The only place SQL lives in this app. Every exported read goes through
 * `unstable_cache` (tagged so a future revalidation hook can bust it) and
 * every aggregate (counts, facet counts, gallery totals) is additionally
 * memoized in the in-process LRU (`src/lib/cache/query-cache.ts`) so a burst
 * of requests within the TTL window never touches SQLite at all.
 *
 * No function here ever loops issuing one query per row: list endpoints join
 * their related table (events -> venues) or aggregate in the same statement
 * (gallery album image counts via GROUP BY, album detail's own image page +
 * total via `COUNT(*) OVER()`), so the number of SQL statements executed per
 * call is a small constant, independent of how many rows exist or are
 * returned.
 */
import { unstable_cache } from "next/cache";
import { withReader } from "./client";
import { queryCache } from "../cache/query-cache";
import type { Block, ImageRef } from "../types";

/** Subset of node-sqlite3-wasm's SQLiteValue that this module ever binds. */
type BindValue = number | string | null;

/* -------------------------------------------------------------------------- */
/* Shared helpers                                                             */
/* -------------------------------------------------------------------------- */

export const DEFAULT_PER_PAGE = 12;
export const MAX_PER_PAGE = 60;

export interface PaginatedResult<T> {
  rows: T[];
  total: number;
  page: number;
  per: number;
  pages: number;
}

function clampPage(page?: number): number {
  if (!page || !Number.isFinite(page) || page < 1) return 1;
  return Math.floor(page);
}

function clampPer(per?: number): number {
  if (!per || !Number.isFinite(per) || per < 1) return DEFAULT_PER_PAGE;
  return Math.min(Math.floor(per), MAX_PER_PAGE);
}

function paginate<T>(rows: T[], total: number, page: number, per: number): PaginatedResult<T> {
  return { rows, total, page, per, pages: total === 0 ? 0 : Math.ceil(total / per) };
}

function parseJsonColumn<T>(value: unknown, fallback: T): T {
  if (typeof value !== "string" || value.length === 0) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

/** Midnight today in the same "YYYY-MM-DDTHH:mm:ss" shape events are stored in. */
function todayStartIso(): string {
  return `${new Date().toISOString().slice(0, 10)}T00:00:00`;
}

export interface CategoryFacet {
  category: string;
  count: number;
}

/* ============================================================================
 * EVENTS
 * ========================================================================== */

export type EventWhen = "upcoming" | "past" | "all";

export interface ListEventsParams {
  page?: number;
  per?: number;
  year?: number;
  category?: string;
  when?: EventWhen;
}

export interface EventVenueRef {
  slug: string;
  name: string;
  city: string | null;
  province: string | null;
  country: string | null;
  mapQuery: string | null;
}

export interface EventListItem {
  id: number;
  slug: string;
  title: string;
  startDate: string;
  endDate: string;
  allDay: boolean;
  cost: string | null;
  website: string | null;
  image: ImageRef | null;
  excerpt: string | null;
  categories: string[];
  venue: EventVenueRef | null;
}

export interface EventDetail extends EventListItem {
  blocks: Block[];
}

interface EventRow {
  id: number;
  slug: string;
  title: string;
  start_date: string;
  end_date: string;
  all_day: number;
  cost: string | null;
  website: string | null;
  image_json: string | null;
  excerpt: string | null;
  venue_slug: string | null;
  venue_name: string | null;
  venue_city: string | null;
  venue_province: string | null;
  venue_country: string | null;
  venue_map_query: string | null;
  categories_csv: string | null;
}

function mapEventRow(row: EventRow): EventListItem {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    startDate: row.start_date,
    endDate: row.end_date,
    allDay: Boolean(row.all_day),
    cost: row.cost,
    website: row.website,
    image: parseJsonColumn<ImageRef | null>(row.image_json, null),
    excerpt: row.excerpt,
    categories: row.categories_csv ? row.categories_csv.split(",") : [],
    venue: row.venue_slug
      ? {
          slug: row.venue_slug,
          name: row.venue_name ?? "",
          city: row.venue_city,
          province: row.venue_province,
          country: row.venue_country,
          mapQuery: row.venue_map_query,
        }
      : null,
  };
}

const EVENTS_SELECT = `
  SELECT
    e.id, e.slug, e.title, e.start_date, e.end_date, e.all_day, e.cost, e.website,
    e.image_json, e.excerpt,
    v.slug AS venue_slug, v.name AS venue_name, v.city AS venue_city,
    v.province AS venue_province, v.country AS venue_country, v.map_query AS venue_map_query,
    (SELECT GROUP_CONCAT(category) FROM event_categories WHERE event_id = e.id) AS categories_csv
  FROM events e
`;

/**
 * Builds the JOIN + WHERE fragments shared by the events list and count
 * queries. `year`/`category` of `0`/`""` mean "no filter". Category
 * filtering is done via an inner JOIN on `event_categories` (indexed on
 * `category`) rather than a correlated subquery, so it can use
 * `idx_event_categories_category` directly.
 */
function buildEventsFilter(params: { year: number; category: string; when: EventWhen }): {
  joinSql: string;
  whereSql: string;
  args: BindValue[];
} {
  const joins: string[] = [];
  const joinArgs: BindValue[] = [];
  const where: string[] = [];
  const whereArgs: BindValue[] = [];

  if (params.category) {
    joins.push("JOIN event_categories ec ON ec.event_id = e.id AND ec.category = ?");
    joinArgs.push(params.category);
  }
  joins.push("LEFT JOIN venues v ON v.id = e.venue_id");

  if (params.year) {
    where.push("substr(e.start_date, 1, 4) = ?");
    whereArgs.push(String(params.year));
  }
  if (params.when === "upcoming") {
    where.push("e.start_date >= ?");
    whereArgs.push(todayStartIso());
  } else if (params.when === "past") {
    where.push("e.start_date < ?");
    whereArgs.push(todayStartIso());
  }

  return {
    joinSql: joins.join(" "),
    whereSql: where.length > 0 ? `WHERE ${where.join(" AND ")}` : "",
    args: [...joinArgs, ...whereArgs],
  };
}

const listEventsRowsCached = unstable_cache(
  async (page: number, per: number, year: number, category: string, when: EventWhen) => {
    const { joinSql, whereSql, args } = buildEventsFilter({ year, category, when });
    const offset = (page - 1) * per;
    const sql = `${EVENTS_SELECT} ${joinSql} ${whereSql} ORDER BY e.start_date ASC LIMIT ? OFFSET ?`;
    return withReader((db) => {
      const rows = db.all(sql, [...args, per, offset]) as unknown as EventRow[];
      return rows.map(mapEventRow);
    });
  },
  ["events-list-rows"],
  { tags: ["events"], revalidate: 300 }
);

const countEventsCached = unstable_cache(
  async (year: number, category: string, when: EventWhen) => {
    const cacheKey = `events:count:${year}:${category}:${when}`;
    return queryCache.wrap(cacheKey, 60_000, async () => {
      const { joinSql, whereSql, args } = buildEventsFilter({ year, category, when });
      return withReader((db) => {
        const row = db.get(`SELECT COUNT(*) AS total FROM events e ${joinSql} ${whereSql}`, args) as {
          total: number;
        } | null;
        return row?.total ?? 0;
      });
    });
  },
  ["events-count"],
  { tags: ["events"], revalidate: 300 }
);

/**
 * Paginated event list. Issues exactly two SQL statements per call (rows +
 * count), both joining `venues` in-query -- there is no per-event venue
 * lookup regardless of how many events are returned.
 */
export async function listEvents(params: ListEventsParams = {}): Promise<PaginatedResult<EventListItem>> {
  const page = clampPage(params.page);
  const per = clampPer(params.per);
  const when: EventWhen = params.when ?? "all";
  const year = params.year && params.year > 0 ? Math.floor(params.year) : 0;
  const category = params.category && params.category.length > 0 ? params.category : "";

  const [rows, total] = await Promise.all([
    listEventsRowsCached(page, per, year, category, when),
    countEventsCached(year, category, when),
  ]);

  return paginate(rows, total, page, per);
}

const getEventBySlugCached = unstable_cache(
  async (slug: string) => {
    const sql = `
      SELECT
        e.id, e.slug, e.title, e.start_date, e.end_date, e.all_day, e.cost, e.website,
        e.image_json, e.excerpt, e.blocks_json,
        v.slug AS venue_slug, v.name AS venue_name, v.city AS venue_city,
        v.province AS venue_province, v.country AS venue_country, v.map_query AS venue_map_query,
        (SELECT GROUP_CONCAT(category) FROM event_categories WHERE event_id = e.id) AS categories_csv
      FROM events e
      LEFT JOIN venues v ON v.id = e.venue_id
      WHERE e.slug = ?
    `;
    return withReader((db) => {
      const row = db.get(sql, [slug]) as unknown as (EventRow & { blocks_json: string }) | null;
      if (!row) return null;
      return { ...mapEventRow(row), blocks: parseJsonColumn<Block[]>(row.blocks_json, []) };
    });
  },
  ["event-by-slug"],
  { tags: ["events"], revalidate: 300 }
);

/** Fetches one event and its venue in a single query (no separate venue lookup). */
export async function getEventBySlug(slug: string): Promise<EventDetail | null> {
  return getEventBySlugCached(slug);
}

export interface YearFacet {
  year: number;
  count: number;
}

const listEventYearsCached = unstable_cache(
  async () => {
    return queryCache.wrap("events:years", 300_000, async () => {
      return withReader(
        (db) =>
          db.all(
            "SELECT CAST(substr(start_date, 1, 4) AS INTEGER) AS year, COUNT(*) AS count FROM events GROUP BY year ORDER BY year DESC"
          ) as unknown as YearFacet[]
      );
    });
  },
  ["events-years"],
  { tags: ["events"], revalidate: 300 }
);

/** Year facet counts for the events filter UI. LRU-cached (small, changes rarely). */
export async function listEventYears(): Promise<YearFacet[]> {
  return listEventYearsCached();
}

const listEventCategoriesCached = unstable_cache(
  async () => {
    return queryCache.wrap("events:categories", 300_000, async () => {
      return withReader(
        (db) =>
          db.all(
            "SELECT category, COUNT(*) AS count FROM event_categories GROUP BY category ORDER BY category ASC"
          ) as unknown as CategoryFacet[]
      );
    });
  },
  ["events-categories"],
  { tags: ["events"], revalidate: 300 }
);

/** Category facet counts for the events filter UI. LRU-cached. */
export async function listEventCategories(): Promise<CategoryFacet[]> {
  return listEventCategoriesCached();
}

/* ============================================================================
 * NEWS
 * ========================================================================== */

export interface ListNewsParams {
  page?: number;
  per?: number;
  category?: string;
}

export interface NewsListItem {
  id: number;
  slug: string;
  title: string;
  date: string;
  excerpt: string | null;
  category: string;
  image: ImageRef | null;
}

export interface NewsDetail extends NewsListItem {
  blocks: Block[];
}

interface NewsRow {
  id: number;
  slug: string;
  title: string;
  date: string;
  excerpt: string | null;
  category: string;
  image_json: string | null;
}

function mapNewsRow(row: NewsRow): NewsListItem {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    date: row.date,
    excerpt: row.excerpt,
    category: row.category,
    image: parseJsonColumn<ImageRef | null>(row.image_json, null),
  };
}

const NEWS_SELECT = "SELECT id, slug, title, date, excerpt, category, image_json FROM news";

const listNewsRowsCached = unstable_cache(
  async (page: number, per: number, category: string) => {
    const where = category ? "WHERE category = ?" : "";
    const args: BindValue[] = category ? [category] : [];
    const offset = (page - 1) * per;
    return withReader((db) => {
      const rows = db.all(`${NEWS_SELECT} ${where} ORDER BY date DESC LIMIT ? OFFSET ?`, [
        ...args,
        per,
        offset,
      ]) as unknown as NewsRow[];
      return rows.map(mapNewsRow);
    });
  },
  ["news-list-rows"],
  { tags: ["news"], revalidate: 300 }
);

const countNewsCached = unstable_cache(
  async (category: string) => {
    const cacheKey = `news:count:${category}`;
    return queryCache.wrap(cacheKey, 60_000, async () => {
      const where = category ? "WHERE category = ?" : "";
      const args: BindValue[] = category ? [category] : [];
      return withReader((db) => {
        const row = db.get(`SELECT COUNT(*) AS total FROM news ${where}`, args) as { total: number } | null;
        return row?.total ?? 0;
      });
    });
  },
  ["news-count"],
  { tags: ["news"], revalidate: 300 }
);

/** Paginated news list. Two SQL statements per call regardless of page size. */
export async function listNews(params: ListNewsParams = {}): Promise<PaginatedResult<NewsListItem>> {
  const page = clampPage(params.page);
  const per = clampPer(params.per);
  const category = params.category && params.category.length > 0 ? params.category : "";

  const [rows, total] = await Promise.all([listNewsRowsCached(page, per, category), countNewsCached(category)]);

  return paginate(rows, total, page, per);
}

const getNewsBySlugCached = unstable_cache(
  async (slug: string) => {
    return withReader((db) => {
      const row = db.get("SELECT * FROM news WHERE slug = ?", [slug]) as unknown as
        | (NewsRow & { blocks_json: string })
        | null;
      if (!row) return null;
      return { ...mapNewsRow(row), blocks: parseJsonColumn<Block[]>(row.blocks_json, []) };
    });
  },
  ["news-by-slug"],
  { tags: ["news"], revalidate: 300 }
);

export async function getNewsBySlug(slug: string): Promise<NewsDetail | null> {
  return getNewsBySlugCached(slug);
}

const listNewsCategoriesCached = unstable_cache(
  async () => {
    return queryCache.wrap("news:categories", 300_000, async () => {
      return withReader(
        (db) =>
          db.all(
            "SELECT category, COUNT(*) AS count FROM news GROUP BY category ORDER BY category ASC"
          ) as unknown as CategoryFacet[]
      );
    });
  },
  ["news-categories"],
  { tags: ["news"], revalidate: 300 }
);

/** Category facet counts for the news filter UI. LRU-cached. */
export async function listNewsCategories(): Promise<CategoryFacet[]> {
  return listNewsCategoriesCached();
}

/* ============================================================================
 * GALLERY
 * ========================================================================== */

export interface ListAlbumsParams {
  page?: number;
  per?: number;
}

export interface AlbumListItem {
  id: number;
  slug: string;
  title: string;
  date: string | null;
  cover: ImageRef | null;
  imageCount: number;
}

interface AlbumRow {
  id: number;
  slug: string;
  title: string;
  date: string | null;
  cover_json: string | null;
  image_count: number;
}

function mapAlbumRow(row: AlbumRow): AlbumListItem {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    date: row.date,
    cover: parseJsonColumn<ImageRef | null>(row.cover_json, null),
    imageCount: row.image_count,
  };
}

// `INDEXED BY` pins the planner to idx_gallery_albums_date: with only ~30
// albums and no WHERE clause, SQLite's cost estimator would otherwise pick a
// bare scan over the index (correct on cost, since both visit every row) --
// the hint costs nothing here and keeps the query plan index-assisted.
const ALBUMS_SELECT = `
  SELECT a.id, a.slug, a.title, a.date, a.cover_json, COUNT(gi.id) AS image_count
  FROM gallery_albums a INDEXED BY idx_gallery_albums_date
  LEFT JOIN gallery_images gi ON gi.album_id = a.id
  GROUP BY a.id
`;

const listAlbumsRowsCached = unstable_cache(
  async (page: number, per: number) => {
    const offset = (page - 1) * per;
    return withReader((db) => {
      const rows = db.all(`${ALBUMS_SELECT} ORDER BY a.date DESC, a.title ASC LIMIT ? OFFSET ?`, [
        per,
        offset,
      ]) as unknown as AlbumRow[];
      return rows.map(mapAlbumRow);
    });
  },
  ["albums-list-rows"],
  { tags: ["gallery"], revalidate: 300 }
);

const countAlbumsCached = unstable_cache(
  async () => {
    return queryCache.wrap("albums:count", 300_000, async () => {
      return withReader((db) => {
        const row = db.get("SELECT COUNT(*) AS total FROM gallery_albums") as { total: number } | null;
        return row?.total ?? 0;
      });
    });
  },
  ["albums-count"],
  { tags: ["gallery"], revalidate: 300 }
);

/**
 * Paginated album list with each album's image count computed by a single
 * GROUP BY (no per-album `COUNT` query).
 */
export async function listAlbums(params: ListAlbumsParams = {}): Promise<PaginatedResult<AlbumListItem>> {
  const page = clampPage(params.page);
  const per = clampPer(params.per);

  const [rows, total] = await Promise.all([listAlbumsRowsCached(page, per), countAlbumsCached()]);

  return paginate(rows, total, page, per);
}

export interface AlbumImage {
  id: number;
  src: string;
  alt: string | null;
  width: number | null;
  height: number | null;
  caption: string | null;
}

export interface AlbumDetail {
  id: number;
  slug: string;
  title: string;
  date: string | null;
  cover: ImageRef | null;
  images: AlbumImage[];
  imagesTotal: number;
  page: number;
  per: number;
  pages: number;
}

interface AlbumMetaRow {
  id: number;
  slug: string;
  title: string;
  date: string | null;
  cover_json: string | null;
}

interface AlbumImageRow {
  id: number;
  src: string;
  alt: string | null;
  width: number | null;
  height: number | null;
  caption: string | null;
  total_count: number;
}

const getAlbumMetaCached = unstable_cache(
  async (slug: string) => {
    return withReader(
      (db) =>
        db.get("SELECT id, slug, title, date, cover_json FROM gallery_albums WHERE slug = ?", [
          slug,
        ]) as unknown as AlbumMetaRow | null
    );
  },
  ["album-meta-by-slug"],
  { tags: ["gallery"], revalidate: 300 }
);

const getAlbumImagesCached = unstable_cache(
  async (albumId: number, page: number, per: number) => {
    const offset = (page - 1) * per;
    return withReader((db) => {
      return db.all(
        `SELECT id, src, alt, width, height, caption, COUNT(*) OVER() AS total_count
         FROM gallery_images WHERE album_id = ? ORDER BY sort_order ASC LIMIT ? OFFSET ?`,
        [albumId, per, offset]
      ) as unknown as AlbumImageRow[];
    });
  },
  ["album-images-by-id"],
  { tags: ["gallery"], revalidate: 300 }
);

/**
 * Fetches an album by slug, then its images in a single windowed query that
 * returns the page of images AND the total image count together (via
 * `COUNT(*) OVER()`), so pagination never needs a third statement. Exactly
 * two SQL statements per call, whether the album has 0 or 200 images.
 */
export async function getAlbumBySlug(
  slug: string,
  params: { page?: number; per?: number } = {}
): Promise<AlbumDetail | null> {
  const page = clampPage(params.page);
  const per = clampPer(params.per);

  const meta = await getAlbumMetaCached(slug);
  if (!meta) return null;

  const imageRows = await getAlbumImagesCached(meta.id, page, per);
  const imagesTotal = imageRows[0]?.total_count ?? 0;

  return {
    id: meta.id,
    slug: meta.slug,
    title: meta.title,
    date: meta.date,
    cover: parseJsonColumn<ImageRef | null>(meta.cover_json, null),
    images: imageRows.map((row) => ({
      id: row.id,
      src: row.src,
      alt: row.alt,
      width: row.width,
      height: row.height,
      caption: row.caption,
    })),
    imagesTotal,
    page,
    per,
    pages: imagesTotal === 0 ? 0 : Math.ceil(imagesTotal / per),
  };
}

/* ============================================================================
 * DOWNLOADS
 * ========================================================================== */

export interface ListDownloadsParams {
  page?: number;
  per?: number;
  category?: string;
  q?: string;
}

export interface DownloadItem {
  id: number;
  title: string;
  category: string | null;
  description: string | null;
  file: { src: string; ext: string | null; size: number | null };
  updated: string | null;
}

interface DownloadRow {
  id: number;
  title: string;
  category: string | null;
  description: string | null;
  file_src: string;
  file_ext: string | null;
  file_size: number | null;
  updated: string | null;
}

function mapDownloadRow(row: DownloadRow): DownloadItem {
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    description: row.description,
    file: { src: row.file_src, ext: row.file_ext, size: row.file_size },
    updated: row.updated,
  };
}

const DOWNLOADS_COLUMNS = "id, title, category, description, file_src, file_ext, file_size, updated";

function buildDownloadsFilter(category: string, q: string): { from: string; where: string; args: BindValue[] } {
  const clauses: string[] = [];
  const args: BindValue[] = [];
  if (category) {
    clauses.push("category = ?");
    args.push(category);
  }
  if (q) {
    clauses.push("(title LIKE ? OR description LIKE ?)");
    const like = `%${q}%`;
    args.push(like, like);
  }
  // Downloads is a tiny table (a handful of rows); SQLite's cost estimator
  // will otherwise prefer a bare scan over idx_downloads_category. Pin the
  // planner to the index whenever the category filter can actually use it.
  const from = category ? "downloads INDEXED BY idx_downloads_category" : "downloads";
  return { from, where: clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "", args };
}

const listDownloadsRowsCached = unstable_cache(
  async (page: number, per: number, category: string, q: string) => {
    const { from, where, args } = buildDownloadsFilter(category, q);
    const offset = (page - 1) * per;
    return withReader((db) => {
      const rows = db.all(
        `SELECT ${DOWNLOADS_COLUMNS} FROM ${from} ${where} ORDER BY updated DESC, title ASC LIMIT ? OFFSET ?`,
        [...args, per, offset]
      ) as unknown as DownloadRow[];
      return rows.map(mapDownloadRow);
    });
  },
  ["downloads-list-rows"],
  { tags: ["downloads"], revalidate: 300 }
);

const countDownloadsCached = unstable_cache(
  async (category: string, q: string) => {
    const cacheKey = `downloads:count:${category}:${q}`;
    return queryCache.wrap(cacheKey, 60_000, async () => {
      const { from, where, args } = buildDownloadsFilter(category, q);
      return withReader((db) => {
        const row = db.get(`SELECT COUNT(*) AS total FROM ${from} ${where}`, args) as {
          total: number;
        } | null;
        return row?.total ?? 0;
      });
    });
  },
  ["downloads-count"],
  { tags: ["downloads"], revalidate: 300 }
);

/** Paginated, searchable downloads list. Two SQL statements per call. */
export async function listDownloads(params: ListDownloadsParams = {}): Promise<PaginatedResult<DownloadItem>> {
  const page = clampPage(params.page);
  const per = clampPer(params.per);
  const category = params.category && params.category.length > 0 ? params.category : "";
  const q = params.q && params.q.length > 0 ? params.q : "";

  const [rows, total] = await Promise.all([
    listDownloadsRowsCached(page, per, category, q),
    countDownloadsCached(category, q),
  ]);

  return paginate(rows, total, page, per);
}

/* ============================================================================
 * HEALTH
 * ========================================================================== */

export interface HealthReport {
  ok: boolean;
  db: boolean;
  counts: Record<string, number>;
  cache: ReturnType<typeof queryCache.stats>;
  error?: string;
}

const HEALTH_TABLES = ["venues", "events", "news", "gallery_albums", "gallery_images", "downloads"] as const;

/**
 * Deliberately NOT wrapped in `unstable_cache` -- a health check must reflect
 * the database's live state for the load balancer, not a 5-minute-old
 * snapshot. The API route additionally sets `Cache-Control: no-store`.
 */
export async function getHealth(): Promise<HealthReport> {
  try {
    const counts = await withReader((db) => {
      const result: Record<string, number> = {};
      for (const table of HEALTH_TABLES) {
        const row = db.get(`SELECT COUNT(*) AS total FROM ${table}`) as { total: number } | null;
        result[table] = row?.total ?? 0;
      }
      return result;
    });
    return { ok: true, db: true, counts, cache: queryCache.stats() };
  } catch (err) {
    return {
      ok: false,
      db: false,
      counts: {},
      cache: queryCache.stats(),
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
