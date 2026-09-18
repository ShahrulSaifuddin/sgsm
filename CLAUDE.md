# SGSM Rebuild — Claude Code Project Guide

The **Senior Golfers' Society of Malaysia (SGSM)** website is a complete rebuild in Next.js 15 + React 19 + TypeScript, replacing the legacy Nicepage-generated site at sgsm.com.my. The goal is prestigious, warm design that drives membership sign-ups; all content and images are extracted from the live site (never invented). The application is production-ready with strict performance and accessibility requirements.

## Stack

| Concern | Choice | Why |
|---|---|---|
| Framework | Next.js 15.5 App Router, React 19, TS strict | Modern server components, built-in streaming, optimal bundle splitting |
| Styling | Tailwind CSS v4 (`@theme` in `globals.css`) | CSS-first, design tokens centralized, zero runtime overhead |
| Motion | `framer-motion` | Performant entrance + hover animations, `prefers-reduced-motion` support |
| Icons | `lucide-react` | Lightweight, tree-shakeable, semantic names |
| Validation | `zod` | Type-safe, fast, no reflection |
| Database | **SQLite via `node-sqlite3-wasm`** | No MSVC build tools on this machine; native build fails; WASM avoids native deps entirely |
| Images | `sharp` (build) + `next/image` (runtime) | AVIF + WebP + original; blur placeholders; optimal `sizes` and `priority` |
| Class utils | `clsx` + `tailwind-merge` via `src/lib/cn.ts` | Conflict-free Tailwind merging |

Do not install new runtime dependencies or swap stack choices. `cheerio` exists as devDependency for build/ingest scripts only.

## Directory Structure

```
content/                         # normalized JSON (committed)
  pages/<slug>.json             # PageDoc: hero, blocks, metadata
  {news,events,venues,gallery,downloads,privileges,council,past-presidents,committees,patrons,partners,site}.json
data/sgsm.db                    # generated SQLite (gitignored)
public/images/<year>/<month>/   # originals committed; .avif/.webp derivatives gitignored
public/images/gallery/<album>/  # 403 event photos (originals committed)
public/files/                   # PDFs + downloads (committed)
scripts/                        # build + ingest tooling (node, .mjs)
src/
  app/                          # routes (see contract §4)
  components/{ui,layout,sections,motion}/   # reusable components
  lib/
    db/                         # client, schema.sql, queries.ts
    cache/                      # memo, LRU for expensive queries
    types.ts cn.ts format.ts seo.ts content.ts
```

## Commands

All work without custom setup. Bash on this Windows machine takes ~2 minutes to start; prefer `PowerShell`:

```bash
npm run dev                  # Next.js dev server (webpack — NOT turbopack, see below)
npm run build                # Production build (webpack — NOT turbopack, see below)
npm start                    # Start production server
npx tsc --noEmit             # Type check (zero errors/warnings required)
npm run lint                 # ESLint (see eslint.config.mjs)
node scripts/fetch-assets.mjs   # Download + optimize images from WordPress dump
```

## Conventions

1. **Server Components by default** — add `"use client"` only to interactive leaves
2. **All data access via `src/lib/db/queries.ts`** — never query from a component
3. **Design tokens live in `src/app/globals.css`** — Tailwind `@theme` block, prefixed `--color-`
4. **Content is read-only** — all data lives in `content/*.json` (extracted, never invented)
5. **No placeholder text** — if source data lacks a value, omit the element
6. **Typed everything** — no `any`; shared types in `src/lib/types.ts`
7. **Images follow A.1 path rule** — `toLocalImage()` deterministically maps WordPress URLs to `/images/<year>/<month>/<name>`

## Performance Checklist

These are non-negotiable and verified by `npm run build` + bundle analysis:

- **Caching**: `unstable_cache` / `revalidate` on every data read; LRU cache for aggregates
- **No N+1**: every event→venue, post→media relationship is a single JOIN
- **Indexed DB**: every `WHERE`/`ORDER BY`/`JOIN` column has an index
- **Connection pool**: bounded reader pool + single writer in `src/lib/db/pool.ts`
- **Pagination**: every list is paginated (default 12/page) with total count from cached query
- **Loading skeletons**: every async surface has a matching skeleton; CLS < 0.05
- **Image compression**: AVIF + WebP at several widths, blur placeholders, `priority` only on LCP
- **Lazy loading**: below-the-fold images lazy; heavy components via `next/dynamic` + `ssr:false`
- **Code splitting**: route-level; lightbox, carousel, map, form dynamically imported
- **Debounced inputs**: 250–300ms debounce on search/filter via `src/lib/use-debounced.ts`
- **Minimal re-renders**: `memo`/`useCallback`/`useMemo` where it matters
- **No third-party render blockers**: all third-party scripts use `next/script` + `strategy="lazyOnload"`
- **Production minification**: enabled in `next.config.ts`; no `compress: false`

## Accessibility Baseline

- One `<h1>` per page, correct heading order, landmarks (`header/nav/main/footer`), skip link
- `alt` on every meaningful image (`alt=""` if decorative)
- Keyboard-operable nav, accordion, lightbox, forms; visible `:focus-visible` ring (gold/fairway)
- ≥44px touch targets; WCAG 2.1 AA contrast (4.5:1 body, 3:1 large text)
- Per-route `metadata` with title, description, canonical, OpenGraph
- JSON-LD `Organization` sitewide, `Event` on event pages

## Notes

- **Do NOT add `--turbopack` to `dev` or `build`.** Both were reverted to webpack because
  Turbopack (Next 15.5.25) breaks this project in two separate ways, each reproduced:
  1. `next dev --turbopack` does not honour `serverExternalPackages`, so `node-sqlite3-wasm`
     gets bundled and opens an **empty in-memory database**. Every data-backed page then
     renders the error boundary with `SQLite3Error: no such table: events` (and `downloads`,
     `gallery_albums`, …) while the real `data/sgsm.db` is perfectly healthy.
     Plain `next dev` serves all the same routes at 200 with no errors.
  2. `next build --turbopack` fails on Windows with
     `ENOENT: no such file or directory, rename '.next/export/500.html'`.
  If a page suddenly reports a missing table, check for `--turbopack` before suspecting the DB.
  Confirm the DB itself with: `node scripts/seed-db.mjs` then `node scripts/db-verify.mjs`.
- **Bash tool takes ~2 minutes to start on this Windows machine.** Use the PowerShell tool for shell commands.
- The `.foreman/` directory is off-limits; it contains schemas and architecture. Read it, do not modify it.
- Workers are building `src/` concurrently. Do not modify files outside the write set (CLAUDE.md, `.claude/settings.json`, `.claude/agents/`, `.claude/commands/`).
- Read `.foreman/contract.md` and `.foreman/schemas.md` for the authoritative architecture and content shapes. When in doubt, they win.
