# SGSM Rebuild — Architecture Contract (authoritative)

Every worker reads this file first. Do not deviate. If something here is impossible,
report `BLOCKED` with the reason — do not improvise an alternative architecture.

## 0. What we are building

A brand-new Next.js website for the **Senior Golfers' Society of Malaysia (SGSM)**,
replacing `https://sgsm.com.my/`. All content, navigation and images come from that
site — nothing is invented. The commercial goal is **membership sign-ups**, so the
design must feel prestigious, warm and trustworthy, and route visitors toward `/join`.

**Never invent facts** (names, dates, prices, phone numbers, results). If a value is
not in the extracted source data, omit the element. Placeholder/lorem text is a defect.

## 1. Stack (fixed — do not add or swap)

| Concern | Choice |
|---|---|
| Framework | Next.js 15.5 App Router, React 19, TypeScript strict |
| Styling | Tailwind CSS v4 (CSS-first `@theme` in `src/app/globals.css`) |
| Motion | `framer-motion` |
| Icons | `lucide-react` |
| Validation | `zod` |
| Database | SQLite via `node-sqlite3-wasm` (no native build on this machine) |
| Images | `sharp` at build time, `next/image` at runtime |
| Class utils | `clsx` + `tailwind-merge` via `src/lib/cn.ts` |

Do **not** install new runtime dependencies. `cheerio` exists as a devDependency and is
for build/ingest scripts only — never import it from `src/`.

## 2. Source data (read-only inputs)

Already downloaded. Do not re-crawl the live site.

- WordPress REST dump: `<SCRATCH>/wp/{pages,posts,media,categories,tags,tribe_venue,tribe_organizer,tribe_events_v1}.json`
- Raw rendered HTML of every crawled page: `<SCRATCH>/raw/*.html` + `<SCRATCH>/raw/_manifest.json`

`<SCRATCH>` = `C:/Users/User/AppData/Local/Temp/claude/C--Users-User-Documents-GitHub-sgsm/3db3b01a-c988-451e-a86d-34505b9d0800/scratchpad`

The source HTML is Nicepage-generated: junk `u-*` classes, inline `<style>`, base64
images, plugin markup. **Never ship that HTML.** Extract semantic content into typed
JSON; render with our own components.

## 3. Directory structure (fixed)

```
content/                     # normalized JSON extracted from the source (committed)
  pages/<slug>.json
  news.json  events.json  venues.json  gallery.json  downloads.json
  privileges.json  council.json  past-presidents.json  committees.json
  patrons.json  partners.json  site.json  media-manifest.json
  README.md                  # documents every schema above
data/sgsm.db                 # generated SQLite (gitignored)
public/images/<category>/…   # optimized images (avif/webp/original)
public/files/                # PDFs and other downloads
scripts/                     # ingest + build tooling (node, .mjs)
deploy/                      # nginx load balancer, docker-compose, CDN notes
src/
  app/                       # routes (see §4)
  components/ui/             # Button, Card, Container, Skeleton, Badge, …
  components/layout/         # Header, Footer, MobileNav, Breadcrumbs
  components/sections/       # page-level composite sections
  components/motion/         # Reveal, Stagger, MotionProvider
  lib/db/                    # client (pool), schema.sql, queries
  lib/cache/                 # memo + LRU for expensive queries
  lib/                       # cn.ts, format.ts, seo.ts, content.ts
```

## 4. Route map (exact — every source page must exist)

| Route | Source page | Notes |
|---|---|---|
| `/` | home | hero carousel, upcoming events, latest news, privileges, partner, join CTA |
| `/president-message` | president-message | |
| `/about-us` | about-us | |
| `/our-history` | our-history | |
| `/patrons-and-honorary-members` | patrons-and-honorary-members | |
| `/past-presidents` | post-presidents | table: No / Name / Year |
| `/council` | council | Council Members 2025–2027 + Officers, photo cards |
| `/working-committees` | event-details | accordion of committees |
| `/sgsm-building` | sgsm-building | |
| `/collaborative-partnership` | collaborative-partnership | |
| `/events` | eventcalendar | paginated + year/category filter + upcoming/past |
| `/events/[slug]` | eventcalendar/<slug> | 49 events, venue + map link |
| `/event-gallery` | event-gallery | albums → lightbox grid, lazy loaded |
| `/event-gallery/[album]` | — | album detail, paginated |
| `/news` | news | paginated list |
| `/news/[slug]` | news-details/<id> | 14 posts |
| `/golfing` | golfing | privilege cards |
| `/hotels-and-restaurants` | hotels-and-restaurants | |
| `/others` | others | |
| `/partners-and-sponsors` | partners-and-sponsors | |
| `/world-handicapping-system` | world-handicapping-system | + the 2 PDFs |
| `/downloads` | downloads | searchable/paginated table |
| `/contact-us` | contact-us | details + form |
| `/join` | — (new) | membership application — the conversion page |

Legacy URLs redirect via `next.config.ts` `redirects()` (permanent):
`/prod/home`→`/`, `/prod/post-presidents`→`/past-presidents`,
`/prod/event-details`→`/working-committees`, `/prod/eventcalendar`→`/events`,
`/prod/news-details/:id`→`/news/:id`, and `/prod/:slug`→`/:slug` for the rest.

Also required: `app/sitemap.ts`, `app/robots.ts`, `app/manifest.ts`,
`app/not-found.tsx`, `app/error.tsx`, and a `loading.tsx` skeleton for every
route segment that reads data.

## 5. Design system (fixed tokens — defined once in `globals.css`)

Heritage golf club, not a generic SaaS page. Deep fairway green, heritage gold,
warm cream paper, generous whitespace, editorial serif headlines.

```
--color-fairway-950 #06251B   --color-fairway-900 #0B3B2E   --color-fairway-700 #16624B
--color-fairway-500 #2E8B68   --color-fairway-100 #DCEBE3
--color-gold-600 #A8801C      --color-gold-500 #C9A227      --color-gold-300 #E3C86B
--color-cream-50 #FBF9F4      --color-cream-100 #F6F3EA     --color-cream-200 #EDE7D8
--color-ink-900 #0F1712       --color-ink-700 #2A3B33       --color-ink-500 #5A6B62
```

- Display/headings: `Fraunces` (next/font/google, variable, `--font-display`)
- Body/UI: `Inter` (next/font/google, variable, `--font-sans`)
- Radius scale 4/8/12/20px; shadows soft and low-contrast; 8px spacing grid.
- Dark mode is **out of scope** — one refined light theme only.
- Every interactive element needs a visible `:focus-visible` ring (gold on dark,
  fairway on light) and a ≥44px touch target.
- Contrast must meet WCAG 2.1 AA (4.5:1 body, 3:1 large text/UI).

### Motion rules
- Purposeful only: entrance reveals (16px rise + fade, 400–600ms, ease-out),
  hover lifts (≤4px, 150–200ms), page-level stagger ≤80ms per item.
- Never animate `width`/`height`/`top`/`left` — only `transform` and `opacity`.
- Everything wrapped so `prefers-reduced-motion: reduce` disables transforms and
  leaves content fully visible. No animation may delay LCP content.
- No parallax on mobile, no scroll-jacking, no autoplaying sound.

## 6. Performance requirements (all mandatory, all verifiable)

1. **Server-side caching** — `unstable_cache` / `revalidate` on every data read.
2. **Expensive-query cache** — `src/lib/cache/query-cache.ts` LRU (TTL + max entries)
   wrapping aggregate queries (counts, year facets, gallery totals).
3. **API response caching** — every `GET` route handler sets
   `Cache-Control: public, s-maxage=…, stale-while-revalidate=…` + `ETag`, and returns
   `304` on `If-None-Match`.
4. **Compressed API payloads** — gzip/deflate via `CompressionStream` when the client
   sends `Accept-Encoding`, plus lean DTOs (never return whole rows).
5. **No N+1** — event→venue, post→media, gallery→images must be single JOIN or
   batched `IN (...)` queries. A loop containing a query is a defect.
6. **Indexed DB** — every column used in `WHERE`/`ORDER BY`/`JOIN` gets an index;
   `scripts/db-verify.mjs` asserts `EXPLAIN QUERY PLAN` shows no `SCAN` on hot queries.
7. **Connection pooling** — `src/lib/db/pool.ts`: bounded reader pool + single writer,
   `acquire/release`, warm-up on first use, graceful close.
8. **Pagination** — every list endpoint/page is paginated (default 12/page) with
   keyset or `LIMIT/OFFSET` + total count from the cached count query.
9. **Loading skeletons** — every async surface has a matching skeleton that mirrors
   final layout (no layout shift). CLS target < 0.05.
10. **Image compression** — all source images converted to AVIF + WebP at several
    widths, with an original fallback; `next/image` with correct `sizes`, `priority`
    only on the LCP image, `placeholder="blur"` from generated blurDataURLs.
11. **Lazy loading** — below-the-fold images lazy; heavy client components via
    `next/dynamic` with `ssr:false` only where they are genuinely client-only.
12. **Code splitting** — route-level by default; lightbox, carousel, map embed and the
    membership form are dynamically imported. No barrel file re-exporting everything.
13. **Debounced inputs** — search/filter inputs debounce 250–300ms via
    `src/lib/use-debounced.ts`; no request per keystroke.
14. **Minimal re-renders** — `memo`/`useCallback`/`useMemo` where it matters, stable
    keys, no state lifted higher than needed, Server Components by default. Add
    `"use client"` only to leaves that truly need it.
15. **Minification** — production build minifies JS/CSS (Next default) and must not be
    disabled; `compress: true` in `next.config.ts`.
16. **Deferred non-critical scripts** — any third-party script uses `next/script` with
    `strategy="lazyOnload"`. No render-blocking third-party CSS/JS.
17. **CDN + load balancer** — `deploy/nginx.conf` (upstream with ≥2 app servers,
    least_conn, health checks, gzip+brotli, immutable cache headers for
    `/_next/static` and `/images`), `deploy/docker-compose.yml` (nginx + 2 app
    replicas), `deploy/CDN.md` documenting the edge caching strategy.
    `/api/health` must exist for the balancer's health check.
18. **No unused dependencies** — `package.json` contains only what is imported.

## 7. Accessibility + SEO baseline

- One `<h1>` per page, correct heading order, landmarks (`header/nav/main/footer`),
  skip-to-content link, `alt` on every meaningful image (`alt=""` if decorative).
- Keyboard-operable nav, accordion, lightbox and forms; visible focus; `aria-current`
  on active nav; focus trap + `Esc` in modals/lightbox.
- Per-route `metadata` with title, description, canonical, OpenGraph; JSON-LD
  `Organization` sitewide and `Event` on event pages.

## 8. Conventions

- Server Components by default; `"use client"` only where required.
- All data access goes through `src/lib/db/queries.ts` — never query from a component.
- Typed everything: no `any`. Shared types in `src/lib/types.ts`.
- `npm run build` and `npx tsc --noEmit` must pass with zero errors and zero warnings.
- Windows/PowerShell environment; scripts must be cross-platform Node (`.mjs`).
- Commit nothing; the foreman handles git.

---

**Appendix A (content schemas) lives in `.foreman/schemas.md` — read it too. `content/site.json` is already written by the foreman; treat it as read-only input.**
