---
---

# /perf-check

Build the app, then audit bundle sizes and verify against the performance checklist.

This slash command triggers the perf-auditor agent to:

1. **Build the app** — `npm run build` with `turbopack`, capture output (time, size, warnings)
2. **Analyze bundles** — inspect `.next/` for route-level JS size, dependencies, code-split points
3. **Type check** — `npx tsc --noEmit` to confirm no regressions
4. **Audit the diff** — scan recent changes for anti-patterns:
   - Missing `unstable_cache` / `revalidate`
   - N+1 queries (loops containing queries)
   - Missing DB indexes
   - Excess `"use client"` on high-level components
   - Uncompressed API responses
   - Unoptimized images
   - Render-blocking third-party scripts
5. **Verify checklist** — confirm all 18 items in contract §6 are met

Output: build metrics, bundle breakdown, checklist audit with pass/fail on each item, and any findings.

Use this:
- Before merging performance-sensitive changes
- After adding dependencies
- Routine QA to catch regressions

Run: `/perf-check`
