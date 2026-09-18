// scripts/extract-events.mjs
//
// Extracts events, venues, photo-gallery albums and downloadable files from the
// old SGSM WordPress export into content/events.json, content/venues.json,
// content/gallery.json and content/downloads.json.
//
// Run with:  node scripts/extract-events.mjs   (from the repo root)
//
// Sources (read-only):
//   <SCRATCH>/wp/tribe_events_v1.json  - The Events Calendar REST dump (49 events)
//   <SCRATCH>/wp/tribe_venue.json      - venue custom post type REST dump (29 venues)
//   <SCRATCH>/wp/media.json            - WP media library, used for image dimensions
//   <SCRATCH>/wp/pages.json            - REST pages dump; event-gallery & downloads content.rendered
//
// This script never re-crawls the live site and never invents data: if a value
// cannot be found or proven, the field/row/image is omitted and the omission is
// called out in the generated README.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as cheerio from 'cheerio';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCRATCH =
  process.env.SGSM_SCRATCH ||
  'C:/Users/User/AppData/Local/Temp/claude/C--Users-User-Documents-GitHub-sgsm/3db3b01a-c988-451e-a86d-34505b9d0800/scratchpad';

const CONTENT_DIR = path.join(ROOT, 'content');

// ---------------------------------------------------------------------------
// §A.1 image-path rule (verbatim from .foreman/schemas.md)
// ---------------------------------------------------------------------------
function toLocalImage(url) {
  const m = String(url).match(/\/wp-content\/uploads\/(\d{4})\/(\d{2})\/(.+)$/);
  if (!m) return null;
  let file = decodeURIComponent(m[3]).split('?')[0].split('#')[0];
  const dot = file.lastIndexOf('.');
  let base = dot === -1 ? file : file.slice(0, dot);
  const ext = dot === -1 ? '' : file.slice(dot).toLowerCase();
  base = base
    .replace(/-\d{2,4}x\d{2,4}$/, '')
    .replace(/-scaled$/, '')
    .replace(/-rotated$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return `/images/${m[1]}/${m[2]}/${base}${ext}`;
}

// PDFs and other documents map the same way but into /files/<YYYY>/<MM>/<name>.ext
function toLocalFile(url) {
  const local = toLocalImage(url);
  return local ? local.replace(/^\/images\//, '/files/') : null;
}

// Extension to §A.1 for this project only: Photo Gallery by WD stores its
// originals under /wp-content/uploads/photo-gallery/<rest> instead of the
// standard /<YYYY>/<MM>/ layout, so the date-based regex above never matches
// them. We map /wp-content/uploads/photo-gallery/<rest> -> /images/gallery/<rest>,
// applying the same lowercase/slug normalisation §A.1 uses for the filename to
// every path segment (so album folder names and the file name are both safe
// URL segments), and applying the WP size-suffix/scaled/rotated strip only to
// the final (file name) segment. This function is pure and deterministic, like
// toLocalImage, and documented in content/README.events.md.
function toLocalGalleryImage(url) {
  const m = String(url).match(/\/wp-content\/uploads\/photo-gallery\/(.+)$/);
  if (!m) return null;
  const rest = decodeURIComponent(m[1]).split('?')[0].split('#')[0];
  const segments = rest.split('/').filter(Boolean);
  if (segments.length === 0) return null;
  const last = segments.pop();
  const dot = last.lastIndexOf('.');
  let base = dot === -1 ? last : last.slice(0, dot);
  const ext = dot === -1 ? '' : last.slice(dot).toLowerCase();
  base = base
    .replace(/-\d{2,4}x\d{2,4}$/, '')
    .replace(/-scaled$/, '')
    .replace(/-rotated$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  const dirs = segments.map((seg) =>
    seg
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
  );
  return `/images/gallery/${[...dirs, `${base}${ext}`].join('/')}`;
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

// Fully decode HTML entities (named + numeric) by round-tripping through
// cheerio's parser, which decodes entities as part of normal HTML parsing.
function decodeHtml(str) {
  if (!str) return '';
  const $ = cheerio.load(`<div>${str}</div>`, null, false);
  return $('div').text();
}

function stripTags(html) {
  if (!html) return '';
  const $ = cheerio.load(`<div>${html}</div>`, null, false);
  return $('div').text().replace(/\s+/g, ' ').trim();
}

function slugify(str) {
  return decodeHtml(str)
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function rewriteLink(href) {
  if (!href) return href;
  let out = href;
  // strip the legacy /prod path prefix from internal links
  out = out.replace(/^https?:\/\/sgsm\.com\.my\/prod/, '');
  // news-details/<id>/ -> best-effort left as-is; no news id->slug map is
  // available to this script (news.json is owned by another extractor), so we
  // only strip the /prod prefix here rather than guess a slug.
  return out;
}

const INLINE_ALLOWED = new Set(['strong', 'em', 'b', 'i', 'a', 'br', 'sup', 'sub']);

function escapeHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Serialize a cheerio node's children into the restricted inline-HTML subset
// allowed by Block['paragraph'|'list'] ("only <strong><em><b><i><a><br><sup><sub> survive").
function serializeInline($, node) {
  let out = '';
  for (const child of node.children || []) {
    out += serializeInlineNode($, child);
  }
  return out;
}

function serializeInlineNode($, node) {
  if (node.type === 'text') {
    return escapeHtml(node.data).replace(/\s+/g, ' ');
  }
  if (node.type === 'tag') {
    const name = node.name.toLowerCase();
    if (INLINE_ALLOWED.has(name)) {
      if (name === 'br') return '<br>';
      if (name === 'a') {
        const href = rewriteLink(node.attribs && node.attribs.href);
        const inner = serializeInline($, node);
        return href ? `<a href="${escapeHtml(href)}">${inner}</a>` : inner;
      }
      const inner = serializeInline($, node);
      return `<${name}>${inner}</${name}>`;
    }
    // Unwrap disallowed tags (u-*, span, u, style, etc.) but keep their text.
    return serializeInline($, node);
  }
  return '';
}

// Convert one event's `description` HTML into Block[] per §A.2. The source is
// mostly <ul>/<ol> detail lists with occasional <p> paragraphs.
function descriptionToBlocks(html) {
  if (!html || !html.trim()) return [];
  const $ = cheerio.load(`<div id="root">${html}</div>`, null, false);
  const root = $('#root')[0];
  const blocks = [];

  function extractListItems($list) {
    const items = [];
    $list.children('li').each((_, li) => {
      const $li = $(li);
      const $clone = $li.clone();
      $clone.find('ul, ol').remove();
      const text = serializeInline($, $clone[0]).trim();
      if (text) items.push(text);
      $li.find('> ul, > ol').each((__, nested) => {
        items.push(...extractListItems($(nested)));
      });
    });
    return items;
  }

  for (const child of root.children || []) {
    if (child.type !== 'tag') continue;
    const name = child.name.toLowerCase();
    if (name === 'ul' || name === 'ol') {
      const items = extractListItems($(child));
      if (items.length) blocks.push({ type: 'list', ordered: name === 'ol', items });
    } else if (name === 'p' || name === 'div' || name === 'span') {
      const text = serializeInline($, child).trim();
      if (text) blocks.push({ type: 'paragraph', html: text });
    }
    // other tags (style/script/etc.) are ignored entirely
  }
  return blocks;
}

function deriveExcerpt(description, maxLen = 160) {
  const text = stripTags(description);
  if (!text) return '';
  if (text.length <= maxLen) return text;
  const cut = text.slice(0, maxLen);
  const lastSpace = cut.lastIndexOf(' ');
  return `${cut.slice(0, lastSpace > 40 ? lastSpace : maxLen)}…`;
}

// ---------------------------------------------------------------------------
// Load sources
// ---------------------------------------------------------------------------
function readJson(relPath) {
  return JSON.parse(fs.readFileSync(path.join(SCRATCH, relPath), 'utf8'));
}

const eventsRaw = readJson('wp/tribe_events_v1.json').events;
const tribeVenues = readJson('wp/tribe_venue.json');
const media = readJson('wp/media.json');
const pages = readJson('wp/pages.json');

// ---------------------------------------------------------------------------
// Media dimension lookup (prefer real media_details over API-embedded sizes)
// ---------------------------------------------------------------------------
const mediaDimByLocalPath = new Map();
for (const m of media) {
  if (!m.mime_type || !m.mime_type.startsWith('image')) continue;
  const local = toLocalImage(m.source_url);
  if (!local) continue;
  const w = m.media_details && m.media_details.width;
  const h = m.media_details && m.media_details.height;
  if (w && h) mediaDimByLocalPath.set(local, { width: w, height: h });
}

// ===========================================================================
// VENUES
// ===========================================================================

// The Events Calendar embeds a fuller venue record (address/city/province/
// zip/country) directly on each event's `venue` object; the plain WP REST
// dump of the tribe_venue post type (wp/tribe_venue.json) does not expose
// those custom fields at all. So: build the address lookup from the events
// dump (real data, keyed by venue slug), then use tribe_venue.json as the
// authoritative list of all 29 venues (some of which are not referenced by
// any of the 49 events, and for which no address is available anywhere in
// the crawled data - those fields are omitted rather than invented).
const venueAddressBySlug = new Map();
for (const e of eventsRaw) {
  const v = e.venue;
  if (v && v.slug && !venueAddressBySlug.has(v.slug)) {
    venueAddressBySlug.set(v.slug, v);
  }
}

const venues = tribeVenues
  .map((tv) => {
    const name = decodeHtml(tv.title.rendered);
    const extra = venueAddressBySlug.get(tv.slug);
    const venue = { id: tv.id, slug: tv.slug, name };
    if (extra) {
      if (extra.address) venue.address = extra.address;
      if (extra.city) venue.city = extra.city;
      if (extra.province) venue.province = extra.province;
      if (extra.zip) venue.zip = extra.zip;
      if (extra.country) venue.country = extra.country;
    }
    const queryParts = [venue.name, venue.address, venue.city, venue.province, venue.zip, venue.country].filter(
      Boolean
    );
    venue.mapQuery = encodeURIComponent(queryParts.join(', '));
    return venue;
  })
  .sort((a, b) => a.id - b.id);

const venueSlugSet = new Set(venues.map((v) => v.slug));

// ===========================================================================
// EVENTS
// ===========================================================================
const events = eventsRaw
  .map((e) => {
    const title = decodeHtml(e.title);
    const localImage = toLocalImage(e.image.url);
    let image = null;
    if (localImage) {
      const dims =
        mediaDimByLocalPath.get(localImage) ||
        (e.image.width && e.image.height ? { width: e.image.width, height: e.image.height } : null);
      if (dims) {
        image = { src: localImage, alt: title, width: dims.width, height: dims.height };
      }
    }
    const venueSlug = e.venue && e.venue.slug && venueSlugSet.has(e.venue.slug) ? e.venue.slug : null;
    return {
      id: e.id,
      slug: e.slug,
      title,
      startDate: e.start_date.replace(' ', 'T'),
      endDate: e.end_date.replace(' ', 'T'),
      allDay: Boolean(e.all_day),
      cost: e.cost || '',
      website: e.website || '',
      image,
      venueSlug,
      categories: (e.categories || []).map((c) => c.slug),
      excerpt: e.excerpt && stripTags(e.excerpt) ? stripTags(e.excerpt) : deriveExcerpt(e.description),
      blocks: descriptionToBlocks(e.description),
    };
  })
  .sort((a, b) => a.id - b.id);

// ===========================================================================
// GALLERY (event-gallery page - Photo Gallery by WD "album extended" markup)
// ===========================================================================
const galleryPage = pages.find((p) => p.slug === 'event-gallery');
const galleryHtml = galleryPage ? galleryPage.content.rendered : '';
const $gallery = cheerio.load(galleryHtml, null, false);

const albumsById = new Map();
$gallery('a[data-alb_gal_id]').each((_, el) => {
  const $el = $gallery(el);
  const albId = $el.attr('data-alb_gal_id');
  if (!albId || albumsById.has(albId)) return; // first occurrence carries the thumbnail
  const title = decodeHtml($el.attr('data-title') || '');
  if (!title) return;
  const $img = $el.find('img').first();
  let cover = null;
  if ($img.length) {
    const src = $img.attr('data-src') || $img.attr('src');
    const local = src ? toLocalGalleryImage(src) : null;
    const w = parseInt($img.attr('data-width'), 10);
    const h = parseInt($img.attr('data-height'), 10);
    if (local && w && h) {
      cover = { src: local, alt: title, width: Math.round(w), height: Math.round(h) };
    }
  }
  albumsById.set(albId, { id: albId, title, cover });
});

// Best-effort date extraction: SGSM album titles embed the event date as free
// text, e.g. "(2nd & 3rd December 2024 @ Glenmarie Golf & Country Club)". We
// only set `date` when a day + month name + year can be read unambiguously
// out of the parenthetical; otherwise the field is omitted rather than guessed.
const MONTHS = {
  jan: '01', january: '01',
  feb: '02', february: '02',
  mar: '03', march: '03',
  apr: '04', april: '04',
  may: '05',
  jun: '06', june: '06',
  jul: '07', july: '07',
  aug: '08', august: '08',
  sep: '09', sept: '09', september: '09',
  oct: '10', october: '10',
  nov: '11', november: '11',
  dec: '12', december: '12',
};
function extractAlbumDate(title) {
  // Titles can carry more than one parenthetical, e.g.
  // "... (Team) (12 Oct 2023 @ Le Grandeur Resort, Johor)" - use whichever
  // one actually contains a month name, not just the first.
  const parens = [...title.matchAll(/\(([^)]*)\)/g)].map((m) => m[1]);
  const monthRe =
    /\b(january|february|march|april|may|june|july|august|september|sept|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec)\b/i;
  const scope = parens.find((p) => monthRe.test(p)) || title;
  const monthMatch = scope.match(
    /\b(january|february|march|april|may|june|july|august|september|sept|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec)\b/i
  );
  const yearMatch = scope.match(/\b(20\d{2})\b/);
  if (!monthMatch || !yearMatch) return undefined;
  const before = scope.slice(0, monthMatch.index);
  const dayMatch = before.match(/(\d{1,2})/);
  if (!dayMatch) return undefined;
  const day = dayMatch[1].padStart(2, '0');
  const month = MONTHS[monthMatch[1].toLowerCase()];
  if (!month) return undefined;
  return `${yearMatch[1]}-${month}-${day}`;
}

// Verify every gallery ImageRef against what the asset pipeline actually has
// on disk (content/media-manifest.json) or under public/. §A.1 keeps content
// extractors decoupled from the asset pipeline, but the foreman explicitly
// asked us to check here because the pipeline's manifest predates this rule.
const mediaManifest = JSON.parse(fs.readFileSync(path.join(CONTENT_DIR, 'media-manifest.json'), 'utf8'));
function localAssetExists(src) {
  if (!src) return false;
  if (Object.prototype.hasOwnProperty.call(mediaManifest, src)) return true;
  const onDisk = path.join(ROOT, 'public', src.replace(/^\//, ''));
  return fs.existsSync(onDisk);
}

let galleryImagesDropped = 0;
const albums = [...albumsById.values()]
  .map((a) => {
    const slug = slugify(a.title);
    const date = extractAlbumDate(a.title);
    let cover = a.cover;
    let images = [];
    if (cover) {
      if (localAssetExists(cover.src)) {
        images = [cover];
      } else {
        galleryImagesDropped += 1;
        cover = null;
      }
    }
    const album = { slug, title: a.title };
    if (date) album.date = date;
    album.cover = cover;
    album.images = images;
    return album;
  })
  .sort((a, b) => (a.date || '').localeCompare(b.date || ''));

const gallery = { albums };

// ===========================================================================
// DOWNLOADS (downloads page - WPDM download-manager table)
// ===========================================================================
const downloadsPage = pages.find((p) => p.slug === 'downloads');
const downloadsHtml = downloadsPage ? downloadsPage.content.rendered : '';
const $downloads = cheerio.load(downloadsHtml, null, false);

// PDF media-library entries are the only source we can use to *prove* a
// download row's file actually exists locally (the WPDM table itself only
// exposes an obfuscated /download/<slug>/?wpdmdl=<id> redirect, never the
// real file URL).
const pdfMedia = media
  .filter((m) => m.mime_type === 'application/pdf')
  .map((m) => ({
    alnum: (m.slug || '').replace(/[^a-z0-9]/gi, '').toLowerCase(),
    source_url: m.source_url,
    filesize: m.filesize,
  }));

function findMatchingPdf(downloadSlug) {
  const alnum = downloadSlug.replace(/[^a-z0-9]/gi, '').toLowerCase();
  return pdfMedia.find((p) => p.alnum.includes(alnum) || alnum.includes(p.alnum));
}

function parseUpdatedDate(text) {
  const m = text.match(/([A-Za-z]+)\s+(\d{1,2}),\s+(\d{4})/);
  if (!m) return undefined;
  const month = MONTHS[m[1].toLowerCase()];
  if (!month) return undefined;
  return `${m[3]}-${month}-${m[2].padStart(2, '0')}`;
}

const downloadRowsFound = [];
const downloads = [];
$downloads('tr.__dt_row').each((_, tr) => {
  const $tr = $downloads(tr);
  const title = decodeHtml($tr.find('strong').first().text().trim());
  if (!title) return;
  const category = decodeHtml($tr.find('.__dt_categories a').first().text().trim()) || undefined;
  const dateText = $tr.find('.__dt_update_date').first().text().trim();
  const updated = parseUpdatedDate(dateText);
  const downloadUrl = $tr.find('a.wpdm-download-link').attr('data-downloadurl') || '';
  const idMatch = downloadUrl.match(/wpdmdl=(\d+)/);
  const id = idMatch ? parseInt(idMatch[1], 10) : null;
  const slugMatch = downloadUrl.match(/\/download\/([^/]+)\//);
  const rowSlug = slugMatch ? slugMatch[1] : slugify(title);

  downloadRowsFound.push({ id, title, category, updated, rowSlug });

  const pdf = findMatchingPdf(rowSlug);
  if (!pdf) return; // real row, but no provable local file - do not fabricate a src
  const src = toLocalFile(pdf.source_url);
  if (!src) return;
  const onDisk = path.join(ROOT, 'public', src.replace(/^\//, ''));
  let sizeBytes = null;
  if (fs.existsSync(onDisk)) {
    sizeBytes = fs.statSync(onDisk).size;
  } else if (typeof pdf.filesize === 'number') {
    sizeBytes = pdf.filesize;
  } else {
    return; // cannot prove the file exists locally at all
  }
  const entry = { id: id ?? downloads.length + 1, title, category, file: { src, ext: 'pdf', sizeBytes } };
  if (updated) entry.updated = updated;
  downloads.push(entry);
});

downloads.sort((a, b) => a.id - b.id);

// ===========================================================================
// Write output
// ===========================================================================
function writeJson(name, data) {
  fs.writeFileSync(path.join(CONTENT_DIR, name), `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

writeJson('events.json', events);
writeJson('venues.json', venues);
writeJson('gallery.json', gallery);
writeJson('downloads.json', downloads);

// ===========================================================================
// README
// ===========================================================================
const unresolvedDownloads = downloadRowsFound.filter(
  (r) => !downloads.some((d) => d.title === r.title)
);

const readme = `# content/events.json, venues.json, gallery.json, downloads.json

Generated by \`scripts/extract-events.mjs\` from the WordPress export in
\`<SCRATCH>/wp/*.json\` and \`<SCRATCH>/raw/*.html\` (see \`.foreman/contract.md\`
and \`.foreman/schemas.md\` §A.1-A.4 for the rules this script follows). Re-run
with \`node scripts/extract-events.mjs\` from the repo root; the script is
idempotent given the same source snapshot.

## The gallery image-path rule (extends §A.1)

Photo Gallery by WD stores its files under \`/wp-content/uploads/photo-gallery/<rest>\`
instead of the standard \`/<YYYY>/<MM>/<file>\` layout, so the §A.1 regex never
matches them. This script adds a second pure, deterministic function,
\`toLocalGalleryImage()\`, defined the same way as \`toLocalImage()\`:

\`\`\`js
// ".../wp-content/uploads/photo-gallery/Annual_Championship_2024/thumb/Annual-Champ-Website.png"
//   -> "/images/gallery/annual-championship-2024/thumb/annual-champ-website.png"
\`\`\`

Every path segment (album folder, \`thumb\`, filename) is lowercased and run
through the same \`[^a-z0-9._-]+\` -> \`-\` collapse §A.1 uses for the filename;
the filename segment additionally gets the WP size-suffix/\`-scaled\`/\`-rotated\`
strip. Non-\`/wp-content/uploads/\` gallery URLs are dropped, same as §A.1.

**Verification result:** none of the 30 photo-gallery album cover images
computed by this rule exist yet in \`content/media-manifest.json\` or under
\`public/\` - the asset-fetch pipeline only downloads standard
\`/<YYYY>/<MM>/\` uploads, and never fetched anything under
\`/wp-content/uploads/photo-gallery/\`. Per the MUST DO check, every gallery
\`ImageRef\` this script computed was verified against the manifest/public and
dropped when unproven: **${galleryImagesDropped} of ${albums.length} album
covers were dropped** (all of them). Albums are still emitted with their real
\`slug\`/\`title\`/\`date\`, but \`cover: null\` and \`images: []\`, because the
album itself is real data (scraped from the live extended-item markup) even
though we cannot yet prove a local image file for it. Re-running this script
after the asset pipeline is extended to fetch \`/wp-content/uploads/photo-gallery/\`
paths will populate covers automatically with no changes needed here.

## Downloads: what could and could not be proven

The \`/downloads/\` page's WPDM table **is** server-rendered (not client-side
only) and yielded ${downloadRowsFound.length} real rows with real
title/category/update-date text. However the table's only file reference is
an obfuscated redirect (\`/prod/download/<slug>/?wpdmdl=<id>\`), never the
underlying \`/wp-content/uploads/...\` file URL, and WPDM's own upload folder
was not part of the WordPress media library dump, so most rows cannot be
resolved to a real, provably-existing file.

This script only emits a download when it can match the row to a PDF that
genuinely exists in \`wp/media.json\` (by normalised slug overlap) **and**
prove a byte size for it (from the file already downloaded under
\`public/files/\`, falling back to the media library's own \`filesize\`). Of
the ${downloadRowsFound.length} rows found, ${downloads.length} were resolved this way:

${downloads.map((d) => `- **${d.title}** -> \`${d.file.src}\` (${d.file.sizeBytes} bytes)`).join('\n')}

The remaining ${unresolvedDownloads.length} rows are real (titles below) but excluded
from \`downloads.json\` because no provable local file exists for them yet -
emitting a fabricated \`file.src\` would violate the "never invent a value" rule:

${unresolvedDownloads.map((r) => `- ${r.title}${r.updated ? ` (updated ${r.updated})` : ''}`).join('\n')}

## content/events.json

\`Event[]\` per §A.3/§A.4. One entry per \`tribe_events_v1.json\` event (49
total). \`description\` HTML (mostly \`<ul>\`/\`<ol>\` detail lists, some \`<p>\`
paragraphs) is converted to \`Block[]\` (\`list\`/\`paragraph\` only - no images,
tables or other block types appear in any of the 49 descriptions). No event in
the source has a non-empty \`excerpt\`, so \`excerpt\` is derived by stripping
the description's HTML and truncating to ~160 characters at a word boundary.
\`startDate\`/\`endDate\` are copied verbatim (space replaced with \`T\`) with no
timezone conversion. \`venueSlug\` is only set when it matches a venue in
\`venues.json\`.

Real example record (first entry, sorted by id):

\`\`\`json
${JSON.stringify(events[0], null, 2)}
\`\`\`

## content/venues.json

\`Venue[]\` per §A.3, all 29 entries from \`wp/tribe_venue.json\` (the
authoritative list of venue posts). \`wp/tribe_venue.json\` itself does not
expose the venue's address/city/province/zip/country - only The Events
Calendar's *event* REST responses embed those fields, on each event's
\`venue\` object - so this script cross-references the 27 venues referenced by
at least one of the 49 events to recover that data. The 2 venues not
referenced by any event (**Tropicana Golf Club**, **Dataran Merdeka**) have no
address data anywhere in the crawled snapshot, so \`address\`/\`city\`/
\`province\`/\`zip\`/\`country\` are omitted for them entirely rather than
invented; \`mapQuery\` falls back to just the venue name in that case.

\`mapQuery\` = \`encodeURIComponent()\` of the venue's non-empty
\`name, address, city, province, zip, country\` fields joined with \`, \`, for
building a Google Maps search link (e.g. \`https://www.google.com/maps/search/?api=1&query=<mapQuery>\`).

Real example record (a venue with full address data):

\`\`\`json
${JSON.stringify(venues.find((v) => v.address), null, 2)}
\`\`\`

Real example of a venue with no recoverable address:

\`\`\`json
${JSON.stringify(venues.find((v) => !v.address), null, 2)}
\`\`\`

## content/gallery.json

\`{ albums: Album[] }\` per §A.3. Albums come from the "Photo Gallery by WD"
(\`bwg-album-extended\`) markup pre-rendered into the \`event-gallery\` page's
\`content.rendered\` (the REST field is otherwise mostly plugin CSS - the real
markup sits in the gap between two \`<style>\` blocks). ${albums.length} distinct
albums were found (deduplicated by the plugin's internal \`data-alb_gal_id\`).
\`date\` is a best-effort extraction from the free-text title (e.g. "...(24th
Oct 2024 @ Templer Park Country Club)") and is only set when a day, month name
and year can be read from the parenthetical unambiguously; see the gallery
image-path section above for why every \`cover\`/\`images\` is currently
\`null\`/\`[]\`.

Real example record:

\`\`\`json
${JSON.stringify(albums.find((a) => a.date) || albums[0], null, 2)}
\`\`\`

## content/downloads.json

\`Download[]\` per §A.3. See "Downloads: what could and could not be proven"
above for how rows were verified. \`description\` is omitted for every row -
the WPDM table on this site never rendered a description column, so there is
no source text to extract.

Real example record:

\`\`\`json
${JSON.stringify(downloads[0], null, 2)}
\`\`\`
`;

fs.writeFileSync(path.join(CONTENT_DIR, 'README.events.md'), readme, 'utf8');

console.log(`events: ${events.length}`);
console.log(`venues: ${venues.length}`);
console.log(`gallery albums: ${albums.length}`);
console.log(`gallery images kept: ${albums.reduce((a, x) => a + x.images.length, 0)} (dropped ${galleryImagesDropped})`);
console.log(`downloads: ${downloads.length} of ${downloadRowsFound.length} rows found`);
