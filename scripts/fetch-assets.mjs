#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.dirname(__dirname);
const scratchpadRoot = 'C:/Users/User/AppData/Local/Temp/claude/C--Users-User-Documents-GitHub-sgsm/3db3b01a-c988-451e-a86d-34505b9d0800/scratchpad';

// Path functions
function toLocalImage(url) {
  const m = String(url).match(/\/wp-content\/uploads\/(\d{4})\/(\d{2})\/(.+)$/);
  if (!m) return null;
  let file = decodeURIComponent(m[3]).split('?')[0].split('#')[0];
  const dot = file.lastIndexOf('.');
  let base = dot === -1 ? file : file.slice(0, dot);
  const ext = dot === -1 ? '' : file.slice(dot).toLowerCase();
  base = base
    .replace(/-\d{2,4}x\d{2,4}$/, '')   // strip WP size suffix  -300x201
    .replace(/-scaled$/, '')            // strip WP -scaled
    .replace(/-rotated$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  // Use /files/ for PDFs, /images/ for others
  const prefix = ext === '.pdf' ? '/files' : '/images';
  return `${prefix}/${m[1]}/${m[2]}/${base}${ext}`;
}

// Load media data
const mediaPath = path.join(scratchpadRoot, 'wp', 'media.json');
const media = JSON.parse(fs.readFileSync(mediaPath, 'utf-8'));

// Prepare download queue
const queue = [];
const urlToMeta = new Map();

// Process media.json
for (const item of media) {
  if (!item.source_url || !item.mime_type) continue;

  const localPath = toLocalImage(item.source_url);
  if (!localPath) continue;

  const match = localPath.match(/\/(images|files)\/(\d{4})\/(\d{2})/);
  if (!match) continue;
  const [, , yyyy, mm] = match;
  const width = item.media_details?.width;
  const height = item.media_details?.height;

  queue.push({
    url: item.source_url,
    localPath,
    mimeType: item.mime_type,
    width,
    height,
    yyyy,
    mm,
  });

  urlToMeta.set(item.source_url, { localPath, width, height, mimeType: item.mime_type });
}

// Scan tribe_events_v1.json and raw HTML for additional URLs
const tribeEventsPath = path.join(scratchpadRoot, 'wp', 'tribe_events_v1.json');
if (fs.existsSync(tribeEventsPath)) {
  const tribeEvents = JSON.parse(fs.readFileSync(tribeEventsPath, 'utf-8'));
  scanForUploadUrls(tribeEvents, queue, urlToMeta);
}

const rawManifestPath = path.join(scratchpadRoot, 'raw', '_manifest.json');
if (fs.existsSync(rawManifestPath)) {
  const rawManifest = JSON.parse(fs.readFileSync(rawManifestPath, 'utf-8'));
  for (const page of rawManifest.pages || []) {
    const htmlPath = path.join(scratchpadRoot, 'raw', page.file);
    if (fs.existsSync(htmlPath)) {
      const html = fs.readFileSync(htmlPath, 'utf-8');
      scanHtmlForUrls(html, queue, urlToMeta);
    }
  }
}

function scanForUploadUrls(obj, queue, urlToMeta) {
  if (!obj || typeof obj !== 'object') return;
  if (Array.isArray(obj)) {
    for (const item of obj) scanForUploadUrls(item, queue, urlToMeta);
    return;
  }
  for (const value of Object.values(obj)) {
    if (typeof value === 'string' && value.includes('/wp-content/uploads/')) {
      const match = value.match(/(https:\/\/sgsm\.com\.my\/prod\/wp-content\/uploads\/\d{4}\/\d{2}\/[^\s"'<>&]+)/);
      if (match && !urlToMeta.has(match[1])) {
        const url = match[1];
        const localPath = toLocalImage(url);
        if (localPath) {
          const pathMatch = localPath.match(/\/(images|files)\/(\d{4})\/(\d{2})/);
          if (pathMatch) {
            const [, , yyyy, mm] = pathMatch;
            const ext = path.extname(url).toLowerCase();
            const mimeType = ext === '.pdf' ? 'application/pdf' : 'image/jpeg';
            queue.push({ url, localPath, mimeType, width: null, height: null, yyyy, mm });
            urlToMeta.set(url, { localPath, width: null, height: null, mimeType });
          }
        }
      }
    }
    scanForUploadUrls(value, queue, urlToMeta);
  }
}

function scanHtmlForUrls(html, queue, urlToMeta) {
  const regex = /(https:\/\/sgsm\.com\.my\/prod\/wp-content\/uploads\/\d{4}\/\d{2}\/[^\s"'<>&;]+)/g;
  let match;
  while ((match = regex.exec(html))) {
    let url = match[1];
    // Remove query string and fragment
    url = url.split('?')[0].split('#')[0];

    if (!urlToMeta.has(url)) {
      const localPath = toLocalImage(url);
      if (localPath) {
        const pathMatch = localPath.match(/\/(images|files)\/(\d{4})\/(\d{2})/);
        if (pathMatch) {
          const [, , yyyy, mm] = pathMatch;
          const ext = path.extname(url).toLowerCase();
          const mimeType = ext === '.pdf' ? 'application/pdf' : 'image/jpeg';
          queue.push({ url, localPath, mimeType, width: null, height: null, yyyy, mm });
          urlToMeta.set(url, { localPath, width: null, height: null, mimeType });
        }
      }
    }
  }
}

// Prepare output directories
function ensureDir(p) {
  if (!fs.existsSync(p)) {
    fs.mkdirSync(p, { recursive: true });
  }
}

const publicImagesRoot = path.join(projectRoot, 'public', 'images');
const publicFilesRoot = path.join(projectRoot, 'public', 'files');
const contentRoot = path.join(projectRoot, 'content');
ensureDir(publicImagesRoot);
ensureDir(publicFilesRoot);
ensureDir(contentRoot);

// Download with retry
async function download(url, maxRetries = 2, timeout = 30000) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('timeout')), timeout);
        https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SGSM-Asset-Pipeline)' } }, (res) => {
          clearTimeout(timer);
          if (res.statusCode !== 200) {
            reject(new Error(`status ${res.statusCode}`));
            return;
          }
          const chunks = [];
          res.on('data', (chunk) => chunks.push(chunk));
          res.on('end', () => resolve(Buffer.concat(chunks)));
          res.on('error', reject);
        }).on('error', reject);
      });
    } catch (err) {
      if (attempt === maxRetries - 1) throw err;
    }
  }
}

// Process file - download and re-encode
async function processFile(item) {
  const { url, localPath, mimeType, width, height, yyyy, mm } = item;

  try {
    let outputPath;
    if (mimeType === 'application/pdf') {
      outputPath = path.join(publicFilesRoot, yyyy, mm, path.basename(localPath));
    } else {
      outputPath = path.join(publicImagesRoot, yyyy, mm, path.basename(localPath));
    }

    // Check if already processed
    if (fs.existsSync(outputPath)) {
      return { status: 'skipped', url, localPath, reason: 'already exists' };
    }

    // Ensure directory
    ensureDir(path.dirname(outputPath));

    // Download
    const buffer = await download(url);
    const originalSize = buffer.length;

    if (mimeType === 'application/pdf') {
      // For PDFs, just save the file
      fs.writeFileSync(outputPath, buffer);
      return { status: 'ok', url, localPath, bytes: originalSize, format: 'pdf' };
    }

    // For images
    const ext = path.extname(localPath).toLowerCase();

    if (ext === '.svg') {
      // SVG: copy through untouched
      fs.writeFileSync(outputPath, buffer);
      return { status: 'ok', url, localPath, bytes: originalSize, format: 'svg' };
    }

    // Get image metadata
    const image = sharp(buffer);
    const metadata = await image.metadata();
    const imgWidth = metadata.width || width;
    const imgHeight = metadata.height || height;

    if (!imgWidth || !imgHeight) {
      throw new Error('cannot determine image dimensions');
    }

    // Re-encode original
    let encoded;
    const ext_lower = ext.toLowerCase();
    if (ext_lower === '.png') {
      encoded = await image.png({ compressionLevel: 9 }).toBuffer();
    } else if (['.jpg', '.jpeg'].includes(ext_lower)) {
      encoded = await image.jpeg({ quality: 82, mozjpeg: true }).toBuffer();
    } else {
      // For other formats, convert to JPEG
      encoded = await sharp(buffer).jpeg({ quality: 82, mozjpeg: true }).toBuffer();
    }

    fs.writeFileSync(outputPath, encoded);

    // Generate blur data URL
    const blurWebp = await sharp(buffer)
      .resize(12, 12, { fit: 'cover' })
      .webp({ quality: 78 })
      .toBuffer();
    const blurDataURL = `data:image/webp;base64,${blurWebp.toString('base64')}`;

    // Generate single AVIF and WebP at native width (capped at 1920px)
    const variants = { avif: [], webp: [] };
    const basename = path.basename(localPath, ext);
    const dirname = path.dirname(localPath);

    // Cap width at 1920px
    const derivWidth = Math.min(imgWidth, 1920);
    const derivHeight = Math.round(imgHeight * derivWidth / imgWidth);

    // AVIF: quality 50, effort 3
    const avifName = `${basename}.avif`;
    const avifPath = path.join(publicImagesRoot, dirname.replace(/^\/images\//, ''), avifName);
    ensureDir(path.dirname(avifPath));
    await sharp(buffer)
      .resize(derivWidth, derivHeight, { withoutEnlargement: true })
      .avif({ quality: 50, effort: 3 })
      .toFile(avifPath);
    variants.avif.push({ w: derivWidth, src: `${dirname}/${avifName}` });

    // WebP: quality 78, effort 4
    const webpName = `${basename}.webp`;
    const webpPath = path.join(publicImagesRoot, dirname.replace(/^\/images\//, ''), webpName);
    ensureDir(path.dirname(webpPath));
    await sharp(buffer)
      .resize(derivWidth, derivHeight, { withoutEnlargement: true })
      .webp({ quality: 78, effort: 4 })
      .toFile(webpPath);
    variants.webp.push({ w: derivWidth, src: `${dirname}/${webpName}` });

    return {
      status: 'ok',
      url,
      localPath,
      bytes: encoded.length,
      width: imgWidth,
      height: imgHeight,
      blurDataURL,
      variants,
      format: 'image',
    };
  } catch (err) {
    return { status: 'error', url, localPath, error: err.message };
  }
}

// Get metadata from existing file for manifest
async function getExistingFileMetadata(item) {
  const { localPath, mimeType, yyyy, mm } = item;

  try {
    let outputPath;
    if (mimeType === 'application/pdf') {
      outputPath = path.join(publicFilesRoot, yyyy, mm, path.basename(localPath));
    } else {
      outputPath = path.join(publicImagesRoot, yyyy, mm, path.basename(localPath));
    }

    if (!fs.existsSync(outputPath)) {
      return { status: 'missing', localPath };
    }

    const stats = fs.statSync(outputPath);

    if (mimeType === 'application/pdf') {
      return {
        status: 'ok',
        localPath,
        bytes: stats.size,
        format: 'pdf',
      };
    }

    // For images, try to get metadata
    const ext = path.extname(localPath).toLowerCase();

    if (ext === '.svg') {
      return {
        status: 'ok',
        localPath,
        bytes: stats.size,
        format: 'svg',
      };
    }

    // Get image metadata
    const buffer = fs.readFileSync(outputPath);
    const metadata = await sharp(buffer).metadata();

    // Find variant files
    const basename = path.basename(localPath, ext);
    const dirname = path.dirname(localPath);
    const dirPath = path.dirname(outputPath);

    const variants = { avif: [], webp: [] };

    // Look for single AVIF and WebP at native width (capped at 1920px)
    const derivWidth = Math.min(metadata.width, 1920);
    const avifName = `${basename}.avif`;
    const avifPath = path.join(dirPath, avifName);
    if (fs.existsSync(avifPath)) {
      variants.avif.push({ w: derivWidth, src: `${dirname}/${avifName}` });
    }

    const webpName = `${basename}.webp`;
    const webpPath = path.join(dirPath, webpName);
    if (fs.existsSync(webpPath)) {
      variants.webp.push({ w: derivWidth, src: `${dirname}/${webpName}` });
    }

    // Generate blur data URL
    const blurWebp = await sharp(buffer)
      .resize(12, 12, { fit: 'cover' })
      .webp({ quality: 78 })
      .toBuffer();
    const blurDataURL = `data:image/webp;base64,${blurWebp.toString('base64')}`;

    return {
      status: 'ok',
      localPath,
      bytes: stats.size,
      width: metadata.width,
      height: metadata.height,
      blurDataURL,
      variants,
      format: 'image',
    };
  } catch (err) {
    return { status: 'error', localPath, error: err.message };
  }
}

// Main execution
async function main() {
  console.log(`Processing ${queue.length} media files...`);

  const manifest = {};
  const results = { ok: 0, skipped: 0, error: 0, files: [], errors: [] };

  // PASS 1: Download missing files
  console.log('\nPass 1: Downloading files...');
  const concurrency = 8;

  for (let i = 0; i < queue.length; i += concurrency) {
    const batch = queue.slice(i, i + concurrency);
    const batchResults = await Promise.all(batch.map(processFile));

    for (const result of batchResults) {
      if (result.status === 'ok') {
        results.ok++;
        results.files.push(result.url);

        if (result.format === 'image') {
          manifest[result.localPath] = {
            width: result.width,
            height: result.height,
            bytes: result.bytes,
            blurDataURL: result.blurDataURL,
            formats: result.variants,
          };
        } else if (result.format === 'pdf') {
          manifest[result.localPath] = {
            bytes: result.bytes,
            formats: {},
          };
        } else if (result.format === 'svg') {
          manifest[result.localPath] = {
            bytes: result.bytes,
            formats: {},
          };
        }
      } else if (result.status === 'skipped') {
        results.skipped++;
      } else if (result.status === 'error') {
        results.error++;
        results.errors.push(`${result.url}: ${result.error}`);
      }
    }

    const processed_count = Math.min(i + concurrency, queue.length);
    console.log(`  ${processed_count}/${queue.length} files processed...`);
  }

  // PASS 2: Build manifest from existing files (for skipped items)
  console.log('\nPass 2: Building manifest from existing files...');
  let manifestCount = 0;
  for (let i = 0; i < queue.length; i += concurrency) {
    const batch = queue.slice(i, i + concurrency);
    const batchResults = await Promise.all(batch.map(getExistingFileMetadata));

    for (const result of batchResults) {
      if (result.status === 'ok' && !manifest[result.localPath]) {
        if (result.format === 'image') {
          manifest[result.localPath] = {
            width: result.width,
            height: result.height,
            bytes: result.bytes,
            blurDataURL: result.blurDataURL,
            formats: result.variants,
          };
        } else if (result.format === 'pdf') {
          manifest[result.localPath] = {
            bytes: result.bytes,
            formats: {},
          };
        } else if (result.format === 'svg') {
          manifest[result.localPath] = {
            bytes: result.bytes,
            formats: {},
          };
        }
        manifestCount++;
      }
    }

    const processed_count = Math.min(i + concurrency, queue.length);
    console.log(`  ${processed_count}/${queue.length} files checked...`);
  }
  console.log(`  Added ${manifestCount} existing files to manifest`);

  // PASS 3: Generate missing derivatives for existing image files
  console.log('\nPass 3: Generating missing derivatives...');
  let derivCount = 0;
  for (let i = 0; i < queue.length; i += concurrency) {
    const batch = queue.slice(i, i + concurrency);

    for (const item of batch) {
      try {
        const { localPath, mimeType, yyyy, mm } = item;

        if (mimeType === 'application/pdf') continue;

        let filePath;
        if (mimeType === 'application/pdf') {
          filePath = path.join(publicFilesRoot, yyyy, mm, path.basename(localPath));
        } else {
          filePath = path.join(publicImagesRoot, yyyy, mm, path.basename(localPath));
        }

        if (!fs.existsSync(filePath)) continue;

        const ext = path.extname(localPath).toLowerCase();

        if (ext === '.svg') continue; // SVGs don't need derivatives

        // Check if derivatives already exist
        const basename = path.basename(localPath, ext);
        const dirname = path.dirname(localPath);
        const dirPath = path.dirname(filePath);

        const avifPath = path.join(dirPath, `${basename}.avif`);
        const webpPath = path.join(dirPath, `${basename}.webp`);

        // If both exist, skip
        if (fs.existsSync(avifPath) && fs.existsSync(webpPath)) continue;

        // Read the original file
        const buffer = fs.readFileSync(filePath);
        const metadata = await sharp(buffer).metadata();

        const imgWidth = metadata.width;
        const imgHeight = metadata.height;

        if (!imgWidth || !imgHeight) continue;

        // Cap width at 1920px
        const derivWidth = Math.min(imgWidth, 1920);
        const derivHeight = Math.round(imgHeight * derivWidth / imgWidth);

        const variants = { avif: [], webp: [] };

        // Generate AVIF if missing
        if (!fs.existsSync(avifPath)) {
          ensureDir(path.dirname(avifPath));
          await sharp(buffer)
            .resize(derivWidth, derivHeight, { withoutEnlargement: true })
            .avif({ quality: 50, effort: 3 })
            .toFile(avifPath);
          variants.avif.push({ w: derivWidth, src: `${dirname}/${basename}.avif` });
        } else {
          variants.avif.push({ w: derivWidth, src: `${dirname}/${basename}.avif` });
        }

        // Generate WebP if missing
        if (!fs.existsSync(webpPath)) {
          ensureDir(path.dirname(webpPath));
          await sharp(buffer)
            .resize(derivWidth, derivHeight, { withoutEnlargement: true })
            .webp({ quality: 78, effort: 4 })
            .toFile(webpPath);
          variants.webp.push({ w: derivWidth, src: `${dirname}/${basename}.webp` });
        } else {
          variants.webp.push({ w: derivWidth, src: `${dirname}/${basename}.webp` });
        }

        // Update manifest with derivatives
        if (manifest[localPath]) {
          manifest[localPath].formats = variants;
        }

        derivCount++;
      } catch (err) {
        // Silently skip on error
      }
    }

    const processed_count = Math.min(i + concurrency, queue.length);
    if ((i / concurrency) % 4 === 0) {  // Log every 4th batch
      console.log(`  ${processed_count}/${queue.length} files processed...`);
    }
  }
  console.log(`  Generated derivatives for ${derivCount} images`);

  // Write manifest
  const manifestPath = path.join(contentRoot, 'media-manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');

  // Report
  console.log(`\nResults:`);
  console.log(`  Downloaded: ${results.ok}`);
  console.log(`  Skipped: ${results.skipped}`);
  console.log(`  Failed: ${results.error}`);

  if (results.errors.length > 0) {
    console.log(`\nFailed downloads:`);
    for (const err of results.errors.slice(0, 20)) {
      console.log(`  ${err}`);
    }
    if (results.errors.length > 20) {
      console.log(`  ... and ${results.errors.length - 20} more`);
    }
  }

  console.log(`\nManifest written to: ${manifestPath}`);
  console.log(`Manifest entries: ${Object.keys(manifest).length}`);
}

main().catch(console.error);
