import type { MetadataRoute } from "next";
import { listEvents, listNews, listAlbums, MAX_PER_PAGE } from "@/lib/db/queries";

/**
 * Base URL for every absolute link in the sitemap. Comes from an env var (set
 * per-environment in the deploy) rather than a hardcoded domain, falling back
 * to the production domain this rebuild replaces (contract §0) so `next build`
 * still produces a valid sitemap when the var is unset (e.g. local preview).
 */
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.sgsm.com.my").replace(/\/$/, "");

type ChangeFreq = MetadataRoute.Sitemap[number]["changeFrequency"];

interface StaticRouteDef {
  path: string;
  changeFrequency: ChangeFreq;
  priority: number;
}

// Every static route from the contract §4 route map (excluding the dynamic
// [slug]/[album] detail pages, which are enumerated from the database below).
const STATIC_ROUTES: StaticRouteDef[] = [
  { path: "/", changeFrequency: "weekly", priority: 1.0 },
  { path: "/join", changeFrequency: "monthly", priority: 0.9 },
  { path: "/events", changeFrequency: "daily", priority: 0.9 },
  { path: "/news", changeFrequency: "daily", priority: 0.8 },
  { path: "/event-gallery", changeFrequency: "weekly", priority: 0.7 },
  { path: "/about-us", changeFrequency: "monthly", priority: 0.6 },
  { path: "/president-message", changeFrequency: "monthly", priority: 0.5 },
  { path: "/our-history", changeFrequency: "yearly", priority: 0.4 },
  { path: "/patrons-and-honorary-members", changeFrequency: "yearly", priority: 0.4 },
  { path: "/past-presidents", changeFrequency: "yearly", priority: 0.4 },
  { path: "/council", changeFrequency: "yearly", priority: 0.5 },
  { path: "/working-committees", changeFrequency: "yearly", priority: 0.4 },
  { path: "/sgsm-building", changeFrequency: "yearly", priority: 0.3 },
  { path: "/collaborative-partnership", changeFrequency: "monthly", priority: 0.4 },
  { path: "/golfing", changeFrequency: "monthly", priority: 0.6 },
  { path: "/hotels-and-restaurants", changeFrequency: "monthly", priority: 0.5 },
  { path: "/others", changeFrequency: "monthly", priority: 0.4 },
  { path: "/partners-and-sponsors", changeFrequency: "monthly", priority: 0.5 },
  { path: "/world-handicapping-system", changeFrequency: "yearly", priority: 0.4 },
  { path: "/downloads", changeFrequency: "monthly", priority: 0.5 },
  { path: "/contact-us", changeFrequency: "yearly", priority: 0.5 },
];

/**
 * Fetches every row across a paginated query, one page at a time at the
 * driver's max page size. Currently the events/news/gallery tables are small
 * enough (49/14/30 rows) that this resolves in a single request each, but it
 * stays correct if those tables grow past `MAX_PER_PAGE` later.
 */
async function fetchAll<T>(
  loadPage: (page: number) => Promise<{ rows: T[]; page: number; pages: number }>
): Promise<T[]> {
  const all: T[] = [];
  let page = 1;
  // Safety cap so a bug in `pages` can never spin this into an infinite loop.
  for (let guard = 0; guard < 200; guard += 1) {
    const result = await loadPage(page);
    all.push(...result.rows);
    if (result.page >= result.pages || result.pages === 0) break;
    page += 1;
  }
  return all;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [events, news, albums] = await Promise.all([
    fetchAll((page) => listEvents({ page, per: MAX_PER_PAGE, when: "all" })),
    fetchAll((page) => listNews({ page, per: MAX_PER_PAGE })),
    fetchAll((page) => listAlbums({ page, per: MAX_PER_PAGE })),
  ]);

  const staticEntries: MetadataRoute.Sitemap = STATIC_ROUTES.map((route) => ({
    url: `${SITE_URL}${route.path}`,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));

  const eventEntries: MetadataRoute.Sitemap = events.map((event) => ({
    url: `${SITE_URL}/events/${event.slug}`,
    lastModified: event.endDate ?? event.startDate,
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  const newsEntries: MetadataRoute.Sitemap = news.map((post) => ({
    url: `${SITE_URL}/news/${post.slug}`,
    lastModified: post.date,
    changeFrequency: "yearly",
    priority: 0.5,
  }));

  const albumEntries: MetadataRoute.Sitemap = albums.map((album) => ({
    url: `${SITE_URL}/event-gallery/${album.slug}`,
    ...(album.date ? { lastModified: album.date } : {}),
    changeFrequency: "yearly",
    priority: 0.4,
  }));

  return [...staticEntries, ...eventEntries, ...newsEntries, ...albumEntries];
}
