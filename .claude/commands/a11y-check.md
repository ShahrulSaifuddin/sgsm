---
---

# /a11y-check

Run through the accessibility checklist for a named route.

This slash command accepts a route argument and audits it against the contract §7 baseline:

```
/a11y-check /events
/a11y-check /news/latest-tournament
/a11y-check /
```

The audit verifies:

1. **Semantics** — one `<h1>`, correct heading order, landmarks (`header/nav/main/footer`), skip-to-content link
2. **Images** — every meaningful image has non-empty `alt`, decorative images have `alt=""`
3. **Links** — all links have clear text (not "click here" or icon-only without `aria-label`)
4. **Forms** — labels properly associated, error messages, validation feedback
5. **Motion** — animations respect `prefers-reduced-motion: reduce`; no motion delays LCP
6. **Color contrast** — body text ≥4.5:1, large text/UI ≥3:1 (WCAG AA)
7. **Focus visible** — all interactive elements have visible `:focus-visible` ring (gold on dark, fairway on light)
8. **Touch targets** — all buttons/inputs ≥44px (tap-friendly)
9. **Keyboard** — nav, accordion, lightbox, forms are fully operable via keyboard; focus trapping in modals
10. **Metadata** — route exports `metadata` with title, description, canonical, OpenGraph
11. **JSON-LD** — organization schema sitewide, event schema on event pages, proper structure

Output: a detailed audit report with pass/fail on each item, specific failures with locations, and suggestions for fixes.

Use this:
- After building a new page
- Before each release
- When adding new interactive patterns

Run: `/a11y-check $ARGUMENTS` (where `$ARGUMENTS` is the route path)
