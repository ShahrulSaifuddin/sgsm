#!/usr/bin/env node
// scripts/fetch-gallery.mjs
//
// Closes two content gaps left by scripts/extract-events.mjs (see
// content/README.events.md "Verification result" / "Downloads: what could and
// could not be proven"):
//
//   1. Event Gallery images. The "Photo Gallery by WD" plugin exposes its
//      albums/images through its AJAX endpoint (admin-ajax.php?action=
//      bwg_frontend_data), which the previous worker never tried. This script
//      walks that endpoint to discover every album's real gallery id, fetches
//      every image in each album (full-size, falling back to the thumb only
//      when the full-size file 404s), downloads + re-encodes them with the
//      same sharp settings scripts/fetch-assets.mjs uses, and fills in
//      content/gallery.json's cover/images for every album that resolves.
//
//   2. Downloads. Every /download/<slug>/?wpdmdl=<id> redirect on the
//      /downloads/ page actually serves a real PDF over HTTP 200 - the
//      previous worker never fetched it. This script re-parses the WPDM
//      table from the crawled downloads page (same source + method as
//      extract-events.mjs), fetches each row's redirect, and trusts the
//      real `content-disposition` filename (not the slug) to name the local
//      file.
//
// Run with:  node scripts/fetch-gallery.mjs   (from the repo root)
//
// Idempotent: a file already on disk (by its computed local path) is never
// re-downloaded; content/gallery.json, content/downloads.json and
// content/media-manifest.json are rewritten deterministically (stable sort,
// 2-space indent) so a second run with the same remote content produces
// byte-identical output.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import https from 'node:https';
import * as cheerio from 'cheerio';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SCRATCH =
  process.env.SGSM_SCRATCH ||
  'C:/Users/User/AppData/Local/Temp/claude/C--Users-User-Documents-GitHub-sgsm/3db3b01a-c988-451e-a86d-34505b9d0800/scratchpad';

const CONTENT_DIR = path.join(ROOT, 'content');
const PUBLIC_DIR = path.join(ROOT, 'public');
const PUBLIC_IMAGES_ROOT = path.join(PUBLIC_DIR, 'images');
const PUBLIC_FILES_ROOT = path.join(PUBLIC_DIR, 'files');

const AJAX = 'https://sgsm.com.my/prod/wp-admin/admin-ajax.php';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) SGSM-Gallery-Fetch/1.0';
const CONCURRENCY = 6;
const RETRIES = 2;
const TIMEOUT_MS = 30000;

// ---------------------------------------------------------------------------
// §A.1 / README.events.md gallery image-path rule (verbatim from
// scripts/extract-events.mjs - kept identical on purpose, no shared state).
// ---------------------------------------------------------------------------
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

// §A.1 filename slugify, reused for the download-manager PDF filenames taken
// from `content-disposition` (keeps the extension).
function slugifyFilename(name) {
  const dot = name.lastIndexOf('.');
  const base = dot === -1 ? name : name.slice(0, dot);
  const ext = dot === -1 ? '' : name.slice(dot).toLowerCase();
  const slug = base
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return `${slug}${ext}`;
}

function decodeHtml(str) {
  if (!str) return '';
  const $ = cheerio.load(`<div>${str}</div>`, null, false);
  return $('div').text();
}

function normTitle(str) {
  return decodeHtml(str)
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

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
function parseUpdatedDate(text) {
  const m = text.match(/([A-Za-z]+)\s+(\d{1,2}),\s+(\d{4})/);
  if (!m) return undefined;
  const month = MONTHS[m[1].toLowerCase()];
  if (!month) return undefined;
  return `${m[3]}-${month}-${m[2].padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// HTTP helpers: redirects, retries, timeout. Never throws out of the run -
// every caller gets back either a response or a recorded failure.
// ---------------------------------------------------------------------------
function httpGetOnce(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      { headers: { 'User-Agent': UA, Accept: '*/*' }, timeout: TIMEOUT_MS },
      (res) => {
        const { statusCode, headers } = res;
        if ([301, 302, 303, 307, 308].includes(statusCode) && headers.location) {
          res.resume();
          const next = new URL(headers.location, url).toString();
          httpGetOnce(next).then(resolve, reject);
          return;
        }
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () =>
          resolve({ url, statusCode, headers, body: Buffer.concat(chunks) })
        );
        res.on('error', reject);
      }
    );
    req.on('timeout', () => req.destroy(new Error(`timeout after ${TIMEOUT_MS}ms`)));
    req.on('error', reject);
  });
}

async function httpGet(url, retries = RETRIES) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await httpGetOnce(url);
    } catch (err) {
      lastErr = err;
    }
  }
  return { url, statusCode: 0, headers: {}, body: Buffer.alloc(0), error: lastErr?.message || 'unknown error' };
}

async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const idx = cursor++;
      results[idx] = await fn(items[idx], idx);
    }
  }
  const workers = Array.from({ length: Math.min(limit, items.length) }, worker);
  await Promise.all(workers);
  return results;
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

// ---------------------------------------------------------------------------
// PART 1: discover every album's real gallery id via bwg_frontend_data
// (type=album_extended), paginating with page_number_0 until a page comes
// back with zero album blocks.
// ---------------------------------------------------------------------------
const ALBUM_BLOCK_RE = /<a class="bwg-a bwg-album bwg_album_0"[\s\S]*?<\/a>/g;

async function discoverAlbums(evidence) {
  const albums = []; // { galleryId, title, coverThumbUrl }
  for (let page = 1; page <= 20; page++) {
    const url =
      `${AJAX}?action=bwg_frontend_data&shortcode_id=1&album_gallery_id=0&type=album_extended` +
      (page > 1 ? `&page_number_0=${page}` : '');
    const res = await httpGet(url);
    if (res.statusCode !== 200) {
      evidence.push({
        step: 'discoverAlbums',
        page,
        url,
        statusCode: res.statusCode,
        error: res.error || null,
        bodyPreview: res.body ? res.body.toString('utf8').slice(0, 300) : null,
      });
      break;
    }
    const html = res.body.toString('utf8');
    const blocks = html.match(ALBUM_BLOCK_RE) || [];
    if (blocks.length === 0) break;
    for (const block of blocks) {
      const galleryId = (block.match(/album_gallery_id_0=(\d+)/) || [])[1];
      const title = (block.match(/data-title="([^"]*)"/) || [])[1];
      const coverThumbUrl = (block.match(/<img[^>]*data-src="([^"]+)"/) || [])[1] || null;
      if (galleryId && title) {
        albums.push({ galleryId: Number(galleryId), title: decodeHtml(title), coverThumbUrl });
      }
    }
  }
  return albums;
}

// ---------------------------------------------------------------------------
// PART 2: fetch every image belonging to one album's real gallery id via
// bwg_frontend_data&type_0=gallery&album_gallery_id_0=<id>, paginating with
// page_number_0 until a page comes back with zero image items.
// ---------------------------------------------------------------------------
const IMAGE_ITEM_RE =
  /<a class="bwg-a\s+bwg_lightbox"\s+data-image-id="(\d+)" href="([^"]+)"[^>]*>[\s\S]*?data-width="([\d.]+)"\s+data-height="([\d.]+)"\s+data-src="([^"]+)"[\s\S]*?alt="([^"]*)"/g;

async function fetchGalleryItems(galleryId, evidence) {
  const byImageId = new Map();
  for (let page = 1; page <= 30; page++) {
    const url =
      `${AJAX}?action=bwg_frontend_data&shortcode_id=1&album_gallery_id=0&type=album_extended&type_0=gallery&album_gallery_id_0=${galleryId}` +
      (page > 1 ? `&page_number_0=${page}` : '');
    const res = await httpGet(url);
    if (res.statusCode !== 200) {
      evidence.push({
        step: 'fetchGalleryItems',
        galleryId,
        page,
        url,
        statusCode: res.statusCode,
        error: res.error || null,
        bodyPreview: res.body ? res.body.toString('utf8').slice(0, 300) : null,
      });
      break;
    }
    const html = res.body.toString('utf8');
    const items = [...html.matchAll(IMAGE_ITEM_RE)];
    if (items.length === 0) break;
    for (const m of items) {
      const imageId = m[1];
      if (byImageId.has(imageId)) continue;
      byImageId.set(imageId, {
        imageId,
        fullUrl: m[2],
        width: Math.round(parseFloat(m[3])) || null,
        height: Math.round(parseFloat(m[4])) || null,
        thumbUrl: m[5],
        alt: decodeHtml(m[6]),
      });
    }
  }
  return [...byImageId.values()].sort((a, b) => Number(a.imageId) - Number(b.imageId));
}

// ---------------------------------------------------------------------------
// Image download + re-encode, matching scripts/fetch-assets.mjs conventions:
// PNG -> png compressionLevel 9; JPEG -> mozjpeg q82; else -> convert to jpeg.
// Derivatives: single AVIF (q50, effort 3) + single WebP (q78, effort 4) at
// native width capped to 1920px; blurDataURL from a 12x12 webp q78 thumbnail.
// ---------------------------------------------------------------------------
async function encodeAndSave(buffer, localPath) {
  const ext = path.extname(localPath).toLowerCase();
  const outputPath = path.join(PUBLIC_IMAGES_ROOT, localPath.replace(/^\/images\//, ''));
  ensureDir(path.dirname(outputPath));

  const image = sharp(buffer);
  const metadata = await image.metadata();
  const imgWidth = metadata.width;
  const imgHeight = metadata.height;
  if (!imgWidth || !imgHeight) throw new Error('cannot determine image dimensions');

  let encoded;
  if (ext === '.png') {
    encoded = await sharp(buffer).png({ compressionLevel: 9 }).toBuffer();
  } else if (ext === '.jpg' || ext === '.jpeg') {
    encoded = await sharp(buffer).jpeg({ quality: 82, mozjpeg: true }).toBuffer();
  } else {
    encoded = await sharp(buffer).jpeg({ quality: 82, mozjpeg: true }).toBuffer();
  }
  fs.writeFileSync(outputPath, encoded);

  // Blur from the final re-encoded bytes (not the original fetch buffer) so
  // this matches readExistingManifestEntry's re-run path exactly - keeps a
  // second run byte-identical to the first instead of only stabilizing from
  // the third run onward.
  const blurWebp = await sharp(encoded).resize(12, 12, { fit: 'cover' }).webp({ quality: 78 }).toBuffer();
  const blurDataURL = `data:image/webp;base64,${blurWebp.toString('base64')}`;

  const basename = path.basename(localPath, ext);
  const dirname = path.dirname(localPath);
  const derivWidth = Math.min(imgWidth, 1920);
  const derivHeight = Math.round((imgHeight * derivWidth) / imgWidth);

  const avifName = `${basename}.avif`;
  const avifPath = path.join(path.dirname(outputPath), avifName);
  await sharp(buffer)
    .resize(derivWidth, derivHeight, { withoutEnlargement: true })
    .avif({ quality: 50, effort: 3 })
    .toFile(avifPath);

  const webpName = `${basename}.webp`;
  const webpPath = path.join(path.dirname(outputPath), webpName);
  await sharp(buffer)
    .resize(derivWidth, derivHeight, { withoutEnlargement: true })
    .webp({ quality: 78, effort: 4 })
    .toFile(webpPath);

  return {
    width: imgWidth,
    height: imgHeight,
    bytes: encoded.length,
    blurDataURL,
    formats: {
      avif: [{ w: derivWidth, src: `${dirname}/${avifName}` }],
      webp: [{ w: derivWidth, src: `${dirname}/${webpName}` }],
    },
  };
}

// Read metadata back out of an already-downloaded+encoded image (idempotent
// re-run path) - same shape as encodeAndSave's return value.
async function readExistingManifestEntry(localPath) {
  const ext = path.extname(localPath).toLowerCase();
  const outputPath = path.join(PUBLIC_IMAGES_ROOT, localPath.replace(/^\/images\//, ''));
  if (!fs.existsSync(outputPath)) return null;
  const buffer = fs.readFileSync(outputPath);
  const metadata = await sharp(buffer).metadata();
  const basename = path.basename(localPath, ext);
  const dirname = path.dirname(localPath);
  const derivWidth = Math.min(metadata.width, 1920);
  const avifSrc = `${dirname}/${basename}.avif`;
  const webpSrc = `${dirname}/${basename}.webp`;
  const avifPath = path.join(PUBLIC_IMAGES_ROOT, avifSrc.replace(/^\/images\//, ''));
  const webpPath = path.join(PUBLIC_IMAGES_ROOT, webpSrc.replace(/^\/images\//, ''));
  const blurWebp = await sharp(buffer).resize(12, 12, { fit: 'cover' }).webp({ quality: 78 }).toBuffer();
  return {
    width: metadata.width,
    height: metadata.height,
    bytes: fs.statSync(outputPath).size,
    blurDataURL: `data:image/webp;base64,${blurWebp.toString('base64')}`,
    formats: {
      avif: fs.existsSync(avifPath) ? [{ w: derivWidth, src: avifSrc }] : [],
      webp: fs.existsSync(webpPath) ? [{ w: derivWidth, src: webpSrc }] : [],
    },
  };
}

// Fetch + encode one gallery image (full-size, thumb fallback), skipping the
// network entirely if the final files already exist on disk. Returns an
// ImageRef-shaped object plus the manifest entry, or null with evidence.
async function fetchOneImage(fullUrl, thumbUrl, alt, evidence) {
  let localPath = toLocalGalleryImage(fullUrl);
  if (!localPath) {
    evidence.push({ step: 'toLocalGalleryImage', url: fullUrl, reason: 'did not match photo-gallery path rule' });
    return null;
  }

  const outputPath = path.join(PUBLIC_IMAGES_ROOT, localPath.replace(/^\/images\//, ''));
  if (fs.existsSync(outputPath)) {
    const manifestEntry = await readExistingManifestEntry(localPath);
    if (manifestEntry) return { localPath, alt, manifestEntry, usedThumbFallback: false, skipped: true };
  }

  let res = await httpGet(fullUrl);
  let usedThumbFallback = false;
  if (res.statusCode !== 200) {
    const fullFailure = {
      step: 'fetchImage(full)',
      url: fullUrl,
      statusCode: res.statusCode,
      error: res.error || null,
    };
    // Fallback to the thumb per the constraints - only when the full-size
    // file genuinely refuses.
    if (thumbUrl) {
      const thumbLocal = toLocalGalleryImage(thumbUrl);
      const thumbRes = await httpGet(thumbUrl);
      if (thumbRes.statusCode === 200 && thumbLocal) {
        evidence.push({ ...fullFailure, fallback: 'thumb used instead', thumbUrl });
        res = thumbRes;
        localPath = thumbLocal;
        usedThumbFallback = true;
      } else {
        evidence.push({
          ...fullFailure,
          fallbackAttempted: thumbUrl,
          fallbackStatusCode: thumbRes.statusCode,
          fallbackError: thumbRes.error || null,
        });
        return null;
      }
    } else {
      evidence.push(fullFailure);
      return null;
    }
  }

  try {
    const manifestEntry = await encodeAndSave(res.body, localPath);
    return { localPath, alt, manifestEntry, usedThumbFallback, skipped: false };
  } catch (err) {
    evidence.push({ step: 'encodeAndSave', url: res.url, localPath, error: err.message });
    return null;
  }
}

function toImageRef({ localPath, alt, manifestEntry }) {
  return {
    src: localPath,
    alt: alt || '',
    width: manifestEntry.width,
    height: manifestEntry.height,
    blurDataURL: manifestEntry.blurDataURL,
  };
}

// ---------------------------------------------------------------------------
// MAIN
// ---------------------------------------------------------------------------
async function main() {
  ensureDir(PUBLIC_IMAGES_ROOT);
  ensureDir(PUBLIC_FILES_ROOT);

  const galleryEvidence = [];
  const downloadEvidence = [];

  const galleryPath = path.join(CONTENT_DIR, 'gallery.json');
  const gallery = JSON.parse(fs.readFileSync(galleryPath, 'utf8'));

  const manifestPath = path.join(CONTENT_DIR, 'media-manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  // ---- PART 1: discover every album's real gallery id ----------------------
  console.log('Discovering albums via bwg_frontend_data (type=album_extended)...');
  const discovered = await discoverAlbums(galleryEvidence);
  console.log(`  discovered ${discovered.length} album entries from the plugin`);

  const discoveredByNormTitle = new Map();
  for (const a of discovered) {
    const key = normTitle(a.title);
    if (!discoveredByNormTitle.has(key)) discoveredByNormTitle.set(key, a);
  }

  // ---- PART 2: for every album already in gallery.json, resolve its images -
  const albumsWithImages = [];
  const albumsWithoutImages = [];

  for (const album of gallery.albums) {
    const match = discoveredByNormTitle.get(normTitle(album.title));
    if (!match) {
      galleryEvidence.push({
        step: 'matchAlbum',
        slug: album.slug,
        title: album.title,
        reason: 'no album in the plugin album_extended listing matched this title',
      });
      albumsWithoutImages.push({ slug: album.slug, title: album.title, reason: 'no matching gallery id found' });
      album.cover = album.cover ?? null;
      album.images = album.images ?? [];
      continue;
    }

    const items = await fetchGalleryItems(match.galleryId, galleryEvidence);
    if (items.length === 0) {
      albumsWithoutImages.push({
        slug: album.slug,
        title: album.title,
        reason: `gallery id ${match.galleryId} returned zero images`,
      });
      album.cover = null;
      album.images = [];
      continue;
    }

    const fetchedImages = await mapLimit(items, CONCURRENCY, (item) =>
      fetchOneImage(item.fullUrl, item.thumbUrl, item.alt, galleryEvidence)
    );
    const okImages = fetchedImages.filter(Boolean);

    for (const img of okImages) {
      manifest[img.localPath] = img.manifestEntry;
    }

    // Cover: the album's own designated banner/cover image (distinct from the
    // numbered gallery items), full-size preferred, thumb fallback.
    let coverRef = null;
    if (match.coverThumbUrl) {
      const coverFullUrl = match.coverThumbUrl.replace('/thumb/', '/');
      const coverResult = await fetchOneImage(coverFullUrl, match.coverThumbUrl, album.title, galleryEvidence);
      if (coverResult) {
        manifest[coverResult.localPath] = coverResult.manifestEntry;
        coverRef = toImageRef(coverResult);
      }
    }
    if (!coverRef && okImages.length > 0) {
      coverRef = toImageRef(okImages[0]);
    }

    if (okImages.length === 0) {
      albumsWithoutImages.push({
        slug: album.slug,
        title: album.title,
        reason: `gallery id ${match.galleryId} listed ${items.length} image(s) but none could be downloaded`,
      });
      album.cover = null;
      album.images = [];
      continue;
    }

    album.cover = coverRef;
    album.images = okImages.map(toImageRef);
    albumsWithImages.push({ slug: album.slug, title: album.title, galleryId: match.galleryId, count: okImages.length });
  }

  // ---- PART 3: downloads ----------------------------------------------------
  console.log('\nParsing the WPDM downloads table from the crawled downloads page...');
  const pages = JSON.parse(fs.readFileSync(path.join(SCRATCH, 'wp', 'pages.json'), 'utf8'));
  const downloadsPage = pages.find((p) => p.slug === 'downloads');
  const $downloads = cheerio.load(downloadsPage ? downloadsPage.content.rendered : '', null, false);

  const rows = [];
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
    // Drop the volatile `&refresh=...` query param - only wpdmdl matters.
    const cleanUrl = downloadUrl.replace(/&refresh=\d+/, '');
    rows.push({ id, title, category, updated, url: cleanUrl });
  });
  console.log(`  found ${rows.length} rows in the table`);

  const downloadResults = await mapLimit(rows, CONCURRENCY, async (row) => {
    if (!row.url) {
      downloadEvidence.push({ step: 'downloadRow', title: row.title, reason: 'no data-downloadurl on this row' });
      return null;
    }
    const res = await httpGet(row.url);
    if (res.statusCode !== 200) {
      downloadEvidence.push({
        step: 'fetchDownload',
        title: row.title,
        url: row.url,
        statusCode: res.statusCode,
        error: res.error || null,
        bodyPreview: res.body ? res.body.toString('utf8').slice(0, 300) : null,
      });
      return null;
    }
    const contentType = res.headers['content-type'] || '';
    if (!contentType.includes('pdf')) {
      downloadEvidence.push({
        step: 'fetchDownload',
        title: row.title,
        url: row.url,
        statusCode: res.statusCode,
        contentType,
        reason: 'response was not a PDF',
      });
      return null;
    }
    const disposition = res.headers['content-disposition'] || '';
    const nameMatch = disposition.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i);
    const rawFilename = nameMatch ? decodeURIComponent(nameMatch[1]) : `${row.url.split('/').filter(Boolean).pop()}.pdf`;
    const filename = slugifyFilename(rawFilename);
    const outputPath = path.join(PUBLIC_FILES_ROOT, filename);

    if (fs.existsSync(outputPath) && fs.statSync(outputPath).size === res.body.length) {
      return {
        id: row.id,
        title: row.title,
        category: row.category,
        updated: row.updated,
        src: `/files/${filename}`,
        sizeBytes: res.body.length,
      };
    }

    ensureDir(path.dirname(outputPath));
    fs.writeFileSync(outputPath, res.body);
    return {
      id: row.id,
      title: row.title,
      category: row.category,
      updated: row.updated,
      src: `/files/${filename}`,
      sizeBytes: res.body.length,
    };
  });

  const downloads = downloadResults
    .filter(Boolean)
    .map((d) => {
      const entry = {
        id: d.id ?? undefined,
        title: d.title,
        category: d.category,
        file: { src: d.src, ext: 'pdf', sizeBytes: d.sizeBytes },
      };
      if (d.updated) entry.updated = d.updated;
      return entry;
    })
    .sort((a, b) => (a.id ?? 0) - (b.id ?? 0));

  // ---- Write outputs ---------------------------------------------------------
  function writeJson(name, data) {
    fs.writeFileSync(path.join(CONTENT_DIR, name), `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  }

  writeJson('gallery.json', gallery);
  writeJson('downloads.json', downloads);
  writeJson('media-manifest.json', manifest);

  // ---- Report -----------------------------------------------------------------
  const totalImages = gallery.albums.reduce((a, x) => a + x.images.length, 0);
  const totalBytes = gallery.albums.reduce(
    (a, x) => a + x.images.reduce((b, img) => b + (manifest[img.src]?.bytes || 0), 0),
    0
  );
  const downloadBytes = downloads.reduce((a, d) => a + (d.file.sizeBytes || 0), 0);

  console.log('\n=== GALLERY ===');
  console.log(`Albums with images: ${albumsWithImages.length} / ${gallery.albums.length}`);
  for (const a of albumsWithImages) console.log(`  OK   ${a.title} -> gallery id ${a.galleryId}, ${a.count} image(s)`);
  console.log(`Albums without images: ${albumsWithoutImages.length}`);
  for (const a of albumsWithoutImages) console.log(`  FAIL ${a.title} -> ${a.reason}`);
  console.log(`Total gallery images downloaded/verified: ${totalImages}`);
  console.log(`Total gallery image bytes (encoded originals): ${totalBytes}`);

  console.log('\n=== DOWNLOADS ===');
  console.log(`Resolved ${downloads.length} / ${rows.length} rows`);
  for (const d of downloads) console.log(`  OK   ${d.title} -> ${d.file.src} (${d.file.sizeBytes} bytes)`);
  console.log(`Total download bytes: ${downloadBytes}`);

  if (galleryEvidence.length > 0) {
    console.log('\n=== GALLERY EVIDENCE (failures/fallbacks) ===');
    console.log(JSON.stringify(galleryEvidence, null, 2));
  }
  if (downloadEvidence.length > 0) {
    console.log('\n=== DOWNLOAD EVIDENCE (failures) ===');
    console.log(JSON.stringify(downloadEvidence, null, 2));
  }

  console.log('\nDone.');
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exitCode = 1;
});
