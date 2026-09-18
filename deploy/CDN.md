# CDN / edge caching strategy

This document describes what gets cached at the edge, for how long, how a
deploy invalidates stale entries, and how the same policy maps onto the three
platforms this app is realistically deployed behind: Cloudflare, CloudFront
(+ any origin), or Vercel's own edge network.

The policy is expressed twice in this repo and must stay in sync:

- **Origin headers** — `next.config.ts` (`headers()`) and each route handler
  under `src/app/api/*` (`src/app/api/_lib/http.ts`) set the real
  `Cache-Control` values below. The CDN's job is to *respect and cache
  according to* these, not to invent its own TTLs.
- **`deploy/nginx.conf`** — mirrors the same policy for the self-hosted
  Docker Compose stack, since that stack has no external CDN in front of it
  by default (see "Self-hosted / no external CDN" below).

## What is cached, and for how long

| Content | Cache-Control (origin) | Edge TTL | Notes |
|---|---|---|---|
| `/_next/static/*` (JS/CSS chunks) | `public, max-age=31536000, immutable` | 1 year, immutable | Filenames are content-hashed by the Next.js build — a changed file is a *new* URL, so there is never a staleness risk. Never purge these; they're never reused. |
| `/images/*` | `public, max-age=31536000, immutable` | 1 year, immutable | Path is deterministic from the source WordPress URL (A.1 rule) and images are never overwritten in place — a changed image ships under a new path. |
| `/files/*` (PDFs, downloads) | `public, max-age=31536000, immutable` | 1 year, immutable | Same reasoning as images. |
| HTML pages (`/`, `/events`, `/news/[slug]`, …) | short `s-maxage` + long `stale-while-revalidate` | 60s fresh, then SWR | Server-rendered from data that changes at most a few times a day (events/news/gallery are re-seeded, not live-edited). A short `s-maxage` keeps content close to fresh without hitting the origin on every request; SWR means visitors never wait on a cache miss — they get the last good copy while it revalidates in the background. |
| `/api/events`, `/api/news`, `/api/gallery`, `/api/downloads` (GET) | `public, s-maxage=300, stale-while-revalidate=86400` (set in `src/app/api/_lib/http.ts`, `LIST_CACHE_CONTROL`) | 5 min fresh, up to 1 day stale-while-revalidate | These are read-only list/detail JSON endpoints backing client-side filtering; a 5-minute edge TTL is invisible to users and drastically cuts origin load. |
| `/api/health` | `no-store` | never cached | Must reflect live DB state for the load balancer / uptime checks (`jsonNoStore` in `src/app/api/_lib/http.ts`). |
| `/api/membership` (POST) | `no-store` | never cached | A mutation; caching a POST response (or letting a CDN coalesce POSTs) would be a correctness bug, not an optimization. |

Every cacheable JSON response also carries an `ETag` (`jsonResponse` in
`src/app/api/_lib/http.ts`), so even within the `stale-while-revalidate`
window a conditional `If-None-Match` revalidation returns `304` instead of a
full body — this works whether or not a CDN sits in front, since it's an
origin-level behavior.

## How purging works on deploy

Because almost everything cacheable is either **content-hashed** (`/_next/static`,
`/images`) or **short-TTL with SWR** (HTML, list APIs), a deploy generally
does not need an explicit purge at all — the new build ships new hashed
asset URLs, and HTML/API entries age out within the TTL window on their own.
The one case that benefits from an explicit purge is when a content update
must be visible immediately (e.g. a corrected event date):

- **Cloudflare**: call the Cache Purge API for the specific URL(s)
  (`POST /zones/:id/purge_cache` with `{"files": ["https://sgsm.com.my/events/annual-championship-2026"]}`)
  as the last step of the deploy pipeline, driven off which `content/*.json`
  files changed. A full "Purge Everything" is reserved for schema-level
  changes to `content/site.json` (nav/footer), since that affects every page.
- **CloudFront**: create an invalidation for the same path(s)
  (`aws cloudfront create-invalidation --distribution-id ... --paths "/events/*" "/news/*"`).
  CloudFront invalidations are billed per path after the free monthly
  allowance, so prefer targeted paths over `/*` where the change is known.
- **Vercel**: no manual purge is needed for the default flow — every deploy
  is immutable and promoted atomically, and Vercel's Data Cache /
  `unstable_cache` tags (`events`, `news`, `gallery`, `downloads` — see
  `src/lib/db/queries.ts`) can be revalidated on demand via
  `revalidateTag()` from a webhook if content changes without a redeploy.

## Mapping onto each platform

### Cloudflare (in front of the Docker Compose / nginx stack, or any VPS)
- DNS-proxied ("orange-clouded") in front of the `nginx` load balancer in
  `deploy/docker-compose.yml`.
- Cloudflare's own edge cache respects origin `Cache-Control` by default for
  static extensions; a **Cache Rule** should be added for `/_next/static/*`,
  `/images/*` and `/files/*` to force `Cache everything` (by default
  Cloudflare only edge-caches whitelisted extensions, and some of these paths
  have no extension in the URL) with **Edge TTL = respect origin headers**.
- Add a Cache Rule for HTML routes with **Edge TTL = respect origin, browser
  TTL = 60s** so `stale-while-revalidate` semantics are preserved rather than
  Cloudflare's default of not caching HTML at all.
- Leave `/api/*` and `/prod/*` (the legacy redirect paths, `next.config.ts`
  `redirects()`) un-cached at Cloudflare's edge — the origin's own
  `Cache-Control` per-route governs those, and redirects must never be
  served from a stale cache.
- Use "Always Use HTTPS" + the HSTS setting to match the
  `Strict-Transport-Security` header already sent by `next.config.ts`
  (Cloudflare's own HSTS app can add `preload` at the zone level once the
  domain is submitted to the HSTS preload list).

### Amazon CloudFront (in front of an ALB/ECS or the same VPS origin)
- Two cache behaviors minimum: one for `/_next/static/*`, `/images/*`,
  `/files/*` with a **Cache Policy** of `CachingOptimized` (respects
  `max-age`/`immutable`, ignores query strings), and a default `/*` behavior
  with a short **Cache Policy** min/default TTL of 0–60s so `s-maxage`/`SWR`
  from the origin governs freshness rather than CloudFront's own default.
- Forward the `Accept-Encoding` header (or use CloudFront's automatic
  compression) so brotli/gzip negotiation still works through the CDN layer,
  matching the gzip/brotli support already in `deploy/nginx.conf`.
- Do **not** cache `/api/membership` or `/api/health` — add a behavior for
  those paths (or `/api/*` generally, since GET list endpoints set their own
  short `s-maxage` anyway) with caching disabled and all headers forwarded.

### Vercel (if deployed there instead of Docker Compose)
- Static assets under `/_next/static` and anything in `public/` (`/images`,
  `/files`) are automatically served from Vercel's Edge Network with
  `immutable` caching honored as-is — no configuration needed.
- Route handlers' `Cache-Control` headers (`src/app/api/_lib/http.ts`) are
  respected by Vercel's Edge/CDN cache the same way; `s-maxage` there means
  what it says at Vercel's shared edge cache layer.
- `unstable_cache` tags (`events`, `news`, `gallery`, `downloads`) map onto
  Vercel's Data Cache; a content update can call `revalidateTag("events")`
  from a Route Handler/Server Action to bust just that data without a full
  redeploy, which is the Vercel-native equivalent of the Cloudflare/CloudFront
  purge step above.
- The `deploy/nginx.conf` load balancer and `docker-compose.yml` replicas are
  not used on Vercel — Vercel's own routing/scaling replaces that layer
  entirely. This document's Cloudflare/CloudFront sections describe the
  self-hosted deployment path in `deploy/`.

## Self-hosted / no external CDN

If the Docker Compose stack in this directory is run standalone (no
Cloudflare/CloudFront in front), `deploy/nginx.conf`'s `proxy_cache_path
html_cache` zone is the only edge cache in the request path: it caches
successful HTML responses for 60 seconds and serves stale content while
revalidating (`proxy_cache_use_stale ... updating`) for exactly the same
reason a real CDN would — decoupling the visitor-facing latency from a
render on a busy replica. Static assets are still cached at the nginx layer
via `add_header Cache-Control ... immutable` on `/_next/static/`, `/images/`
and `/files/`, matching the origin policy above.
