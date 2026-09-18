---
---

# /new-page

Scaffold a new route following project conventions.

This slash command accepts a route name and uses the page-builder agent to create the full structure:

```
/new-page /my-new-page
/new-page /products/[id]
/new-page /api/search
```

The agent will:

1. **Create route directory** — `src/app/<route>/`
2. **Generate page.tsx** — Server Component with:
   - `metadata` export (title, description, canonical, OpenGraph)
   - Data fetching via `src/lib/db/queries.ts` with `unstable_cache` / `revalidate`
   - Semantic HTML (heading hierarchy, landmarks)
   - Tailwind styling using design tokens
   - Images optimized with `next/image`
3. **Generate loading.tsx** — skeleton matching final layout (prevents CLS)
4. **Generate error.tsx** — error boundary
5. **Create any needed UI components** — in `src/components/sections/` or `src/components/ui/`
6. **Integrate data layer** — fetch from `content/*.json` via queries, no invented data
7. **Verify** — run `npx tsc --noEmit` to confirm types

The new page will:
- Follow all performance rules (contract §6)
- Meet accessibility baseline (contract §7)
- Use the design system (layout, tokens, motion)
- Be ready for content and refinement

Output: file list, type check result, next steps for integration.

Use this:
- When adding a new route from contract §4
- When creating interior routes like `/events/[slug]`
- When building forms or dynamic content pages

Run: `/new-page $ARGUMENTS` (where `$ARGUMENTS` is the route path, e.g., `/events/new`)
