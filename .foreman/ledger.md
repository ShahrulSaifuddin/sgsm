# Foreman Ledger — SGSM Next.js rebuild

BASELINE: `38c9c0ee837b8cf99d482e331f89541bd295be8f` | 11 porcelain entries (Next scaffold + .foreman + content/site.json, uncommitted) | 2026-09-17

Mode: **Full** (Agent tool + real shell). Codex not probed — user specified Claude
sonnet/haiku workers, so no Codex consent is needed.
LEAD seat: Opus 5 (frontier) — plans, routes, reviews. Does not implement.

## Plan

| # | Task | Class |
|---|---|---|
| T1 | Asset pipeline: download + compress all 451 images and 2 PDFs, emit media-manifest | FAST |
| T2 | Content extraction A: pages, news, privileges, council, past presidents, committees, patrons, partners | WORKHORSE |
| T3 | Content extraction B: events, venues, gallery albums, downloads | WORKHORSE |
| T4 | Design system + layout shell: tokens, fonts, UI kit, Header/Footer, motion, skeletons | WORKHORSE |
| T5 | Data layer: SQLite schema + indexes, pool, seed, cached queries, API routes | WORKHORSE |
| T6 | Society pages (9 routes) | WORKHORSE |
| T7 | Events + gallery routes | WORKHORSE |
| T8 | News + privileges + downloads + contact + /join membership form | WORKHORSE |
| T9 | Home page | WORKHORSE |
| T10 | Perf/infra: next.config, sitemap/robots/manifest, nginx LB, docker-compose, CDN doc | WORKHORSE |
| T11 | Claude project setup: .claude/ settings, agents, commands, CLAUDE.md | FAST |
| V1 | Blind verification + Lighthouse audit | FRONTIER/verifier |

## Routing

- T1 → haiku: mechanical fetch/resize loop, fully specified, no judgment.
- T2, T3 → sonnet: messy HTML parsing needs real inference about structure.
- T4 → sonnet: design judgment within fixed tokens the foreman supplied.
- T5 → sonnet: SQL + caching correctness matters.
- T6–T9 → sonnet: composition against a fixed design system.
- T10 → sonnet: config correctness matters more than volume.
- T11 → haiku: templated config files.
- V1 → foreman-verifier (fresh context, no edit tools) + deterministic Lighthouse.

## Tasks

| id | state | owned paths | job |
|---|---|---|---|
| T1 | DISPATCHED | scripts/fetch-assets.mjs, public/images/**, public/files/**, content/media-manifest.json | wave1-a |
| T2 | DISPATCHED | scripts/extract-pages.mjs, content/pages/**, content/{news,privileges,council,past-presidents,committees,patrons,partners}.json, content/README.md | wave1-b |
| T3 | DISPATCHED | scripts/extract-events.mjs, content/{events,venues,gallery,downloads}.json, content/README.events.md | wave1-c |
| T4 | DISPATCHED | src/app/layout.tsx, src/app/globals.css, src/app/page.tsx (placeholder), src/components/{ui,layout,motion}/**, src/lib/{cn,types,format}.ts | wave1-d |
| T5 | PENDING | src/lib/db/**, src/lib/cache/**, src/lib/content.ts, src/app/api/**, scripts/{seed-db,db-verify}.mjs | — |
| T6 | PENDING | src/app/(site)/<9 society routes>/** | — |
| T7 | PENDING | src/app/(site)/events/**, src/app/(site)/event-gallery/** | — |
| T8 | PENDING | src/app/(site)/{news,golfing,hotels-and-restaurants,others,partners-and-sponsors,world-handicapping-system,downloads,contact-us,join}/** | — |
| T9 | PENDING | src/app/(site)/page.tsx, src/components/sections/home/** | — |
| T10 | PENDING | next.config.ts, src/app/{sitemap,robots,manifest}.ts, deploy/**, package.json scripts | — |
| T11 | PENDING | .claude/**, CLAUDE.md | — |

## Attempts

| task | # | seat | ticket rev | outcome | checks | evidence | when |
|---|---|---|---|---|---|---|---|
| T11 | 1 | haiku | r1 | DONE | foreman re-ran: 8 files exist, settings.json parses, no hooks configured | `.claude/{settings.json,agents/*3,commands/*4}`, `CLAUDE.md` (76 lines, worker claimed 120 — immaterial) | 2026-09-17 |
| T1 | 1 | haiku | r1 | LOST (external: HTTP 429 session limit) | n/a | partial: ~450 originals + 2 PDFs downloaded, manifest w/ 455 entries, but 0 avif / 3 webp derivatives | 2026-09-17 |
| T2 | 1 | sonnet | r1 | LOST (external: HTTP 429 session limit) | n/a | partial: `scripts/extract-pages.mjs` (47KB) written, **zero** content output | 2026-09-17 |
| T3 | 1 | sonnet | r1 | LOST (external: HTTP 429 session limit) | n/a | nothing landed | 2026-09-17 |
| T4 | 1 | sonnet | r1 | LOST (external: HTTP 429 session limit) | n/a | partial: globals.css, 8 ui/*, 3 motion/*, MobileNav, lib/{cn,types,format}; `layout.tsx` still the untouched scaffold; no Header/Footer/Breadcrumbs/Prose | 2026-09-17 |
| T1 | 2 | haiku | r2 (resume) | DONE → VERIFIED | foreman re-ran an independent disk-vs-manifest audit: 455 entries, 0 non-pdf incomplete, 0 missing avif/webp refs, 0 manifest entries pointing at a non-existent file; on disk 451 avif + 451 webp + 450 originals | originals 71.98MB → 16.4MB avif (77% saving); the 2 "incomplete" entries the worker reported are genuinely the 2 PDFs | 2026-09-18 |
| T2 | 2 | sonnet | r2 (resume) | DISPATCHED | — | — | 2026-09-18 |
| T4 | 2 | sonnet | r2 (resume) | DONE → VERIFIED | foreman re-ran `npx tsc --noEmit` (exit 0); confirmed layout/Header/Footer/Breadcrumbs/Prose/Accordion exist; all 10 Block variants covered by the Prose switch; real allowlist sanitizer present; 0 `any`, 0 Tailwind dark-mode variants | worker found + fixed a real defect: `framer-motion@13` renamed `reduceMotion`→`reducedMotion` (TS2322), which would have failed the build. Minor fence breach: also wrote `.claude/launch.json` (dev tooling, benign, kept) | 2026-09-18 |
| T2 | 2 | sonnet | r2 (resume) | DONE → VERIFIED | foreman re-ran: 13 page files all with non-empty blocks + description; news 14, council 30 in 2 groups, past-presidents 39, committees 14, patrons 5, partners 10, golfing privileges 11 with **0 orphan refs**; spot-checked council/committee/patron records — name/role/years correctly separated | worker found + fixed real defects in the inherited script: `.text()` across `<br>` produced `"SecretaryNegeri Sembilan Representative"`; patron name/honorific swapped; broken internal-link rewrites; card `alt` falling back to page title. Its claim that `hotels-and-restaurants`/`others` are empty is **true** — foreman checked source: both are "page is under construction" placeholders | 2026-09-18 |
| T3 | 2 | sonnet | r2 (clean restart) | DONE_WITH_CONCERNS | foreman re-ran: events 49, venues 29, albums 30, **images 0**, downloads 2, orphan venueSlugs 0 | events/venues/README good. Two real gaps + one defect found by foreman probe (below) → fix wave dispatched, not accepted yet | 2026-09-18 |
| T3fix | 1 | sonnet | r1 | DONE → VERIFIED (T3 accepted with it) | foreman re-ran an independent audit: albums 30, withImages 30, images 403, downloads 7; ghost image files 0, missing manifest entries 0, albums w/o cover 0, images w/o alt 0, images w/o dims 0, ghost downloads 0; all 7 PDF byte sizes match the foreman's own HTTP probe exactly | gallery recovered via `bwg_frontend_data&type=album_extended&album_gallery_id_0=<id>` (36 gallery ids discovered, paginated); 403 images, 59.8MB re-encoded originals + derivatives; mismapped WHS form corrected to `sgsm-gogolf-application-form-v4.pdf` (485,359 B). Worker also self-found and fixed a blur-hash asymmetry that broke idempotency | 2026-09-18 |
| T5 | 1 | sonnet | r1 | LOST mid-verification (HTTP 429 again) but work complete → VERIFIED BY FOREMAN | foreman ran the remaining checks itself: `node scripts/seed-db.mjs` → venues 29 / events 49 / news 14 / albums 30 / downloads 7; `node scripts/db-verify.mjs` → **18/18 hot queries, no full-table scans**; `npx tsc --noEmit` exit 0; `npx next build` exit 0 with all 6 API routes registered, 103 kB shared First Load JS | 33 typed query exports, 9 content loaders, pool + LRU + ETag/304/gzip handlers all present | 2026-09-18 |
| — | — | foreman | — | FIX | `next build --turbopack` fails on Windows with `ENOENT rename .next/export/500.html` (Turbopack export race). Non-turbopack `next build` passes | changed `package.json` build script to `next build`; `dev` keeps `--turbopack` | 2026-09-18 |
| T6 | 1 | sonnet | r1 | DONE (stopped idling on a build poll) → VERIFIED | 9 society routes on disk, 22 loading.tsx, tsc exit 0; covered by the final full build | — | 2026-09-18 |
| T7 | 1 | sonnet | r1 | DONE (stopped idling) → VERIFIED | events + gallery routes on disk, tsc exit 0; covered by the final full build | — | 2026-09-18 |
| T8 | 1 | sonnet | r1 | DONE_WITH_CONCERNS → gaps found by foreman | `/contact-us` **never created** despite being in the ticket; `membership_applications` table **empty** — the required end-to-end test was never run | worker believed itself complete; filesystem + DB check caught both | 2026-09-18 |
| T8fix | 1 | sonnet | r1 | DONE → VERIFIED | foreman confirmed `/contact-us` + components on disk and 4 real rows in `membership_applications` | real evidence: 201 + persisted row, 400 with zod field errors, 429 rate limit. No defect in `/join` | 2026-09-18 |
| T9 | 1 | sonnet | r1 | DONE → VERIFIED | tsc exit 0; home page composed from real data | good judgment: inspected the source carousel and rejected it (seasonal greetings; one slide is an unrelated real-estate ad). Foreman confirmed independently | 2026-09-18 |
| T9fix | 1 | sonnet | r1 | DONE → VERIFIED | tsc exit 0 | photographic hero from a real 1200x800 SGSM delegation photo; aspect box matched to source so nothing upscales; scrim measured ~6.1:1; no animation gating LCP | 2026-09-18 |
| T10 | 1 | sonnet | r1 | DONE → VERIFIED | foreman smoke test: all 5 legacy redirects 308 to the right targets, sitemap/robots/manifest 200 with correct content types, security headers present | honest concerns raised: no PWA icons in `public/`; stock `nginx:alpine` lacks the brotli module; fixed a real `npm ci` → `npm install` bug (no lockfile in repo) | 2026-09-18 |
| T5fix | 1 | sonnet | r1 | DONE → VERIFIED | foreman ran the full build: **exit 0, 121/121 static pages**; db-verify still 18/18 | root cause was `readOnly: true` + no `busy_timeout`; fix = busy_timeout 8000 on every connection, drop readOnly, MAX_READERS 3→1. Worker also found WAL silently no-ops (journal stays `delete`) while `writerPragmaStatus()` reports "applied" — cosmetic, logged | 2026-09-18 |
| V1 | 1 | foreman | — | PASS | **smoke test: 0 failures** across 26 pages, 3 meta routes, 5 APIs (cache-control + ETag + 304 + gzip all correct), 5 redirects, 404, security headers. **Lighthouse (mobile preset, slow-4G, 4x CPU): Performance 93, Accessibility 100, Best Practices 100, SEO 100; FCP 1.1s, LCP 3.2s, TBT 50ms, CLS 0, SI 1.2s** | LCP 3.2s identical cold and warm → not a cache miss; hero preload advertises 14 widths up to 3840w for a 1200px source, and no `fetchpriority`. Pre-built AVIF/WebP were going unused → T11 dispatched | 2026-09-18 |
| T11perf | 1 | sonnet | r1 | LOST to HTTP 429 after edits → reconciled + VERIFIED by foreman | foreman re-ran build (exit 0) and both Lighthouse profiles | **Measured null/negative result, honestly reported and reverted**: the `<picture>`+AVIF hero *regressed* LCP (Perf 93→89, LCP 3.2s→3.7s) reproducibly. Bisection showed fetchPriority, preload, srcset and AVIF decode were all at parity; only the `<picture>` DOM added ~450ms render delay. LCP phase breakdown = TTFB ~465ms + Load ~0ms + **Render Delay ~2200-2800ms (70-87%)**, i.e. main-thread bound, not delivery bound. Kept only the `deviceSizes`/`imageSizes` cap | 2026-09-18 |
| V2 | 1 | foreman | — | PASS (final) | build exit 0; **Lighthouse DESKTOP: Perf 99 / A11y 100 / BP 100 / SEO 100, FCP 0.4s, LCP 0.8s, TBT 0ms, CLS 0, SI 0.5s**; **MOBILE (slow-4G + 4x CPU): Perf 92 / A11y 100 / BP 100 / SEO 100, FCP 1.5s, LCP 3.2s, TBT 50ms, CLS 0** | removed unused `@types/better-sqlite3` (leftover from the rejected native driver); build re-verified green after removal | 2026-09-18 |

## Verification posture (disclosure)

Repeated account session limits (HTTP 429) made a separate blind-verifier wave
impractical without stalling the run. Verification was therefore **deterministic and
foreman-led** rather than blind-agent-led: every accepted change was graded by the
foreman re-running the real gates itself (`next build`, `tsc --noEmit`,
`scripts/db-verify.mjs`, a 40-assertion HTTP smoke test, Lighthouse, and direct SQLite
queries), never by reading a worker's narrative. Per the skill's reduced-assurance
rule this is disclosed rather than presented as blind verification. A reproduced
deterministic result outranks any verdict, and three worker claims were overturned
this way (T3's "unrecoverable" gallery, T8's "complete" report, T5's passing build).

## Decisions

- **better-sqlite3 rejected**: needs a native MSVC build; no build tools on this
  machine (`npm error gyp ERR! not ok`). Replaced with `node-sqlite3-wasm`, verified
  working and using real indexes (`EXPLAIN QUERY PLAN` → `SEARCH … USING COVERING INDEX`).
- **Source data pulled once** via the WordPress REST API + a full crawl, so no worker
  hits the live site: 22 pages, 14 posts, 49 events, 29 venues, 451 media, 2 PDFs.
- **`content/site.json` written by the foreman** to decouple T4 (needs nav) from T2.
- **Image paths are computed by a pure function** (schemas.md §A.1) so T1 and T2/T3
  can run in parallel without a shared lookup table.
- **Rate-limit incident (2026-09-17)**: all four wave-1 workers died mid-flight on
  HTTP 429 (account session limit), not on task or seat failure. Per the precedence
  table this is an *external blocker*, so it does not count as a seat failure — same
  seats, same tickets, revised with the reconciled on-disk state. Dispatch policy
  changed from 4-way parallel to **2 at a time, sequential waves**, to stay inside the
  budget and ride prompt-cache warmth.
- **Image derivatives scoped down**: pre-generating 5 widths x 2 formats x ~450 images
  (~4,500 sharp encodes) does not fit a worker's 600s tool timeout. Now one AVIF +
  one WebP at native width (capped 1920) per image, with `next/image` doing responsive
  resizing at runtime via `formats: ['image/avif','image/webp']`. Still satisfies the
  image-compression requirement; the manifest shape in schemas.md §A.3 is unchanged
  (the `formats` arrays simply carry one entry each).
- **T3's "unrecoverable" verdict was wrong, and the foreman proved it before accepting.**
  T3 reported the gallery images did not exist and 5 of 7 downloads were unprovable.
  A foreman probe showed otherwise:
  (a) the Photo Gallery by WD plugin serves its data from
  `wp-admin/admin-ajax.php?action=bwg_frontend_data` — 60 distinct `photo-gallery`
  paths, plus `&type=album_extended` for album covers; T3 never called it.
  (b) all 7 WPDM rows fetch fine at `/download/<slug>/?wpdmdl=<id>` → HTTP 200,
  `content-type: application/pdf`, with the true filename in `content-disposition`;
  T3 never tried fetching the redirect.
  (c) the slugs are misleading, which produced a real **mismapping**:
  `sgsm-whs-application-form` serves `SGSM-GoGolf-Application-Form-V4.pdf` (485,359 B),
  not `SGSM-WHS-Application-Form-V1.pdf` (464,975 B) as T3 recorded; and
  `sgsm-fixtures-2024` serves `SGSM-Fixtures-2025.pdf`.
  Lesson applied to the fix ticket: "prove a failure with the HTTP response, don't
  infer absence from a missing local file."
- **User-named skills unavailable**: taste, ui-ux-pro-max, awesome-claude-design,
  design-motion-principle, design-andy-chrome, graphify returned zero results in both
  the skill library and the plugin catalog. Using `design:*` skills + explicit tokens.

## Scratch

- Source dump: `<SCRATCH>/wp/*.json`, `<SCRATCH>/raw/*.html`
- Worker reports: `.foreman/scratch/`
