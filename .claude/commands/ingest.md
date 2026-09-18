---
---

# /ingest

Re-run the whole content + asset pipeline and report what changed.

This slash command triggers the content-extractor agent to:

1. **Fetch assets** — run `node scripts/fetch-assets.mjs` to download, optimize, and manifest images from the WordPress dump
2. **Validate content** — check all `content/*.json` files against their schemas in `.foreman/schemas.md`
3. **Audit for defects** — scan for invented data, unprocessed HTML, broken links, missing `alt` text, duplicate images
4. **Report changes** — show what content was added/updated/removed, image counts, and any warnings

Use this when:
- The WordPress dump has been updated with new content
- Content extraction logic has been fixed and needs a full re-run
- You need to verify the entire content layer is in sync with the source

Outputs a summary table: content type, count, last modified, any anomalies.

Run: `/ingest`
