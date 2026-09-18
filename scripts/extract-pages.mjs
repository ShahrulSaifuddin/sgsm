// scripts/extract-pages.mjs
//
// Extracts editorial content from the old SGSM WordPress export into typed JSON
// under content/. Idempotent: running it twice produces byte-identical output.
//
// Source (read-only): <SCRATCH>/wp/{pages,posts,media,categories}.json
// See .foreman/contract.md and .foreman/schemas.md for the authoritative shapes.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as cheerio from "cheerio";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const CONTENT_DIR = path.join(ROOT, "content");
const PAGES_DIR = path.join(CONTENT_DIR, "pages");

const SCRATCH =
  process.env.WP_DATA_DIR ||
  "C:/Users/User/AppData/Local/Temp/claude/C--Users-User-Documents-GitHub-sgsm/3db3b01a-c988-451e-a86d-34505b9d0800/scratchpad";
const WP_DIR = path.join(SCRATCH, "wp");

// ---------------------------------------------------------------------------
// A.1 — the image-path rule (verbatim from schemas.md)
// ---------------------------------------------------------------------------
function toLocalImage(url) {
  const m = String(url).match(/\/wp-content\/uploads\/(\d{4})\/(\d{2})\/(.+)$/);
  if (!m) return null;
  let file = decodeURIComponent(m[3]).split("?")[0].split("#")[0];
  const dot = file.lastIndexOf(".");
  let base = dot === -1 ? file : file.slice(0, dot);
  const ext = dot === -1 ? "" : file.slice(dot).toLowerCase();
  base = base
    .replace(/-\d{2,4}x\d{2,4}$/, "") // strip WP size suffix  -300x201
    .replace(/-scaled$/, "") // strip WP -scaled
    .replace(/-rotated$/, "")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return `/images/${m[1]}/${m[2]}/${base}${ext}`;
}

// Same mapping, but for PDFs/documents -> /files/<YYYY>/<MM>/<name>.pdf
function toLocalFile(url) {
  const m = String(url).match(/\/wp-content\/uploads\/(\d{4})\/(\d{2})\/(.+)$/);
  if (!m) return null;
  let file = decodeURIComponent(m[3]).split("?")[0].split("#")[0];
  const dot = file.lastIndexOf(".");
  let base = dot === -1 ? file : file.slice(0, dot);
  const ext = dot === -1 ? "" : file.slice(dot).toLowerCase();
  base = base
    .replace(/-\d{2,4}x\d{2,4}$/, "")
    .replace(/-scaled$/, "")
    .replace(/-rotated$/, "")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return `/files/${m[1]}/${m[2]}/${base}${ext}`;
}

// ---------------------------------------------------------------------------
// Load source data
// ---------------------------------------------------------------------------
function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(WP_DIR, file), "utf8"));
}

const wpPages = readJson("pages.json");
const wpPosts = readJson("posts.json");
const wpMedia = readJson("media.json");

function findPage(slug) {
  const p = wpPages.find((x) => x.slug === slug);
  if (!p) throw new Error(`page not found in wp export: ${slug}`);
  return p;
}

// id -> slug map for posts, used to rewrite internal news-details links
const postIdToSlug = new Map(wpPosts.map((p) => [p.id, p.slug]));

// Media dimension lookup keyed by the local /images/... path.
// Prefer the widest known variant when several WP attachments collapse to the
// same local path (e.g. the original vs. a "-scaled" duplicate).
const mediaDims = new Map();
for (const m of wpMedia) {
  const src = m.source_url || (m.guid && m.guid.rendered);
  if (!src) continue;
  const local = toLocalImage(src);
  if (!local) continue;
  const w = m.media_details && m.media_details.width;
  const h = m.media_details && m.media_details.height;
  if (!w || !h) continue;
  const prev = mediaDims.get(local);
  if (!prev || w > prev.width) mediaDims.set(local, { width: w, height: h });
}

// ---------------------------------------------------------------------------
// Entity decoding (A.4)
// ---------------------------------------------------------------------------
const NAMED_ENTITIES = {
  nbsp: " ",
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  hellip: "\u2026",
  rsquo: "\u2019",
  lsquo: "\u2018",
  rdquo: "\u201d",
  ldquo: "\u201c",
  mdash: "\u2014",
  ndash: "\u2013",
};

function decodeEntities(str) {
  if (!str) return str;
  return str
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(parseInt(n, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-zA-Z]+);/g, (m, name) => {
      const key = name.toLowerCase();
      return Object.prototype.hasOwnProperty.call(NAMED_ENTITIES, key) ? NAMED_ENTITIES[key] : m;
    });
}

function collapseWs(str) {
  return decodeEntities(String(str || ""))
    .replace(/\u00a0/g, " ")
    // Zero-width junk characters (copy-paste artifacts from Word/CMS editors).
    .replace(/[\u200b\u200c\u200d\ufeff]/g, "")
    .replace(/[ \t\r\n]+/g, " ")
    .trim();
}

// Split an element's text on its <br> tags, decoding entities and trimming
// each resulting line. Unlike `.text()` (which concatenates text nodes with
// no separator at all), this preserves the visual line breaks Nicepage uses
// to separate distinct facts (e.g. role vs. years, honorific vs. name). An
// ASCII marker is used as the split point (rather than e.g. a NUL byte, which
// HTML parsing drops) since `replaceWith` re-parses its argument as markup.
function splitByBr($, el) {
  const clone = $(el).clone();
  clone.find("br").replaceWith("@@BR@@");
  const raw = collapseWs(clone.text());
  return raw
    .split("@@BR@@")
    .map((s) => collapseWs(s))
    .filter(Boolean);
}

// ---------------------------------------------------------------------------
// Link rewriting (A.4)
// ---------------------------------------------------------------------------
const SLUG_ROUTE_MAP = {
  "post-presidents": "/past-presidents",
  "event-details": "/working-committees",
  eventcalendar: "/events",
  "event-gallery": "/event-gallery",
  home: "/",
  front_page: "/",
  blog: "/news",
};

function rewriteLink(href) {
  if (!href) return null;
  href = href.trim();
  if (!href || href === "#" || /^javascript:/i.test(href)) return null;

  const isInternal = /sgsm\.com\.my/i.test(href) || href.startsWith("/prod");
  if (!isInternal) return href; // genuinely external — leave alone

  let rest = href
    .replace(/^https?:\/\/(www\.)?sgsm\.com\.my/i, "")
    .replace(/^\/prod/, "");
  rest = rest.split("?")[0].split("#")[0];
  rest = rest.replace(/\/+$/, ""); // drop trailing slash
  rest = rest.replace(/^\/+/, ""); // drop leading slash for matching

  if (!rest) return "/";

  // A same-site link straight into /wp-content/uploads/ (PDFs, images linked
  // from body text rather than through a dedicated media block) maps through
  // the A.1 rule instead of the page-slug map.
  if (/^wp-content\/uploads\//i.test(rest)) {
    const full = `https://sgsm.com.my/prod/${rest}`;
    const ext = (rest.match(/\.([a-z0-9]+)$/i) || [, ""])[1].toLowerCase();
    const imageExts = new Set(["jpg", "jpeg", "png", "gif", "webp", "svg", "avif"]);
    return imageExts.has(ext) ? toLocalImage(full) : toLocalFile(full);
  }

  const newsMatch = rest.match(/^news-details\/(\d+)$/);
  if (newsMatch) {
    const slug = postIdToSlug.get(Number(newsMatch[1]));
    return slug ? `/news/${slug}` : null;
  }

  const [firstSeg, ...restSegs] = rest.split("/");
  if (Object.prototype.hasOwnProperty.call(SLUG_ROUTE_MAP, firstSeg)) {
    const mapped = SLUG_ROUTE_MAP[firstSeg];
    return restSegs.length ? `${mapped}/${restSegs.join("/")}` : mapped;
  }

  return `/${rest}`;
}

// ---------------------------------------------------------------------------
// Inline HTML sanitizer — only <strong><em><b><i><a><br><sup><sub> survive (A.2/A.4)
// ---------------------------------------------------------------------------
function stripToAllowedInline(html) {
  if (!html) return "";
  let out = String(html);

  out = out.replace(/<!--[\s\S]*?-->/g, "");
  out = out.replace(/<quillbot-extension-highlights[\s\S]*?<\/quillbot-extension-highlights\s*>/gi, "");
  out = out.replace(/<quillbot-extension-highlights[^>]*\/?>/gi, "");
  out = out.replace(/<qb-[a-z-]+[\s\S]*?<\/qb-[a-z-]+\s*>/gi, "");
  out = out.replace(/<(script|style|svg|canvas)[\s\S]*?<\/\1\s*>/gi, "");
  out = out.replace(/<img[^>]*>/gi, "");
  out = out.replace(/style\s*=\s*"[^"]*"/gi, "");
  out = out.replace(/style\s*=\s*'[^']*'/gi, "");
  out = out.replace(/\sdata-[a-z-]+\s*=\s*"[^"]*"/gi, "");
  out = out.replace(/\sdata-[a-z-]+\s*=\s*'[^']*'/gi, "");
  out = out.replace(/<br\s*\/?>/gi, "<br>");

  // Track how many <a> opens we actually kept, so a closing </a> whose
  // opening tag had no usable href (or was itself dropped) doesn't leak
  // through as an orphaned closing tag with no matching open.
  let openAnchors = 0;
  out = out.replace(/<(\/?)([a-zA-Z][a-zA-Z0-9]*)([^>]*)>/g, (full, closing, tagRaw, attrs) => {
    const tag = tagRaw.toLowerCase();
    if (["strong", "em", "b", "i", "sup", "sub"].includes(tag)) {
      return closing ? `</${tag}>` : `<${tag}>`;
    }
    if (tag === "br") return "<br>";
    if (tag === "a") {
      if (closing) {
        if (openAnchors > 0) {
          openAnchors -= 1;
          return "</a>";
        }
        return "";
      }
      const hrefMatch = attrs.match(/href\s*=\s*"([^"]*)"/i) || attrs.match(/href\s*=\s*'([^']*)'/i);
      const rawHref = hrefMatch ? hrefMatch[1] : "";
      const href = rewriteLink(collapseWs(rawHref));
      if (!href) return "";
      openAnchors += 1;
      return `<a href="${href.replace(/"/g, "&quot;")}">`;
    }
    return "";
  });

  // Drop now-empty <a></a> left behind when the href was dropped.
  out = out.replace(/<a href="">/gi, "");

  out = decodeEntities(out).replace(/\u00a0/g, " ");
  out = out.replace(/[\u200b\u200c\u200d\ufeff]/g, "");
  out = out.replace(/[ \t\r\n]+/g, " ").trim();

  // Tidy empty inline tags produced by stripping (repeat until stable).
  let prev;
  do {
    prev = out;
    out = out.replace(/<(strong|em|b|i|sup|sub|a)( [^>]*)?>\s*<\/\1>/gi, "");
  } while (out !== prev);

  return out.trim();
}

function plainText(html) {
  return collapseWs(String(html || "").replace(/<[^>]+>/g, " "));
}

// ---------------------------------------------------------------------------
// Image resolution
// ---------------------------------------------------------------------------
function resolveImage(url, { alt, dataWidth, dataHeight, fallbackAlt } = {}) {
  if (!url) return null;
  const local = toLocalImage(url);
  if (!local) return null;

  let width;
  let height;
  const dims = mediaDims.get(local);
  if (dims) {
    width = dims.width;
    height = dims.height;
  } else if (dataWidth && dataHeight) {
    width = Number(dataWidth);
    height = Number(dataHeight);
  }
  if (!width || !height) return null;

  const cleanAlt = collapseWs(alt || "");
  const finalAlt = cleanAlt || collapseWs(fallbackAlt || "");
  if (!finalAlt) return null;

  return { src: local, alt: finalAlt, width, height };
}

function extractBgImageUrl(styleAttr) {
  if (!styleAttr) return null;
  const m = styleAttr.match(/background-image\s*:\s*url\((['"]?)([^'")]+)\1\)/i);
  return m ? m[2] : null;
}

// ---------------------------------------------------------------------------
// Generic block builders
// ---------------------------------------------------------------------------
function headingBlock(level, text) {
  const t = collapseWs(text);
  if (!t) return null;
  return { type: "heading", level, text: t };
}

function paragraphBlock(html) {
  const cleaned = stripToAllowedInline(html);
  if (!cleaned || !plainText(cleaned)) return null;
  return { type: "paragraph", html: cleaned };
}

function listBlock(ordered, items) {
  const cleaned = items.map((i) => stripToAllowedInline(i)).filter((i) => i && plainText(i));
  if (!cleaned.length) return null;
  return { type: "list", ordered, items: cleaned };
}

function imageBlock(image, caption) {
  if (!image) return null;
  const block = { type: "image", image };
  const cap = collapseWs(caption || "");
  if (cap) block.caption = cap;
  return block;
}

function quoteBlock(html, attribution) {
  const cleaned = stripToAllowedInline(html);
  if (!cleaned || !plainText(cleaned)) return null;
  const block = { type: "quote", html: cleaned };
  const attr = collapseWs(attribution || "");
  if (attr) block.attribution = attr;
  return block;
}

// ---------------------------------------------------------------------------
// Nicepage page -> Block[] (generic narrative walker)
// ---------------------------------------------------------------------------
// Used for the simple, mostly-linear content pages: president-message,
// about-us, our-history, sgsm-building, hotels-and-restaurants, others.
function nicepageNarrativeBlocks($, root, pageTitle) {
  const blocks = [];
  const seenTitle = new Set([collapseWs(pageTitle).toLowerCase()]);

  function walk(node) {
    const el = $(node);
    const tag = node.tagName ? node.tagName.toLowerCase() : null;
    if (!tag) return;

    if (["script", "style", "svg", "form", "iframe"].includes(tag)) return;
    if (tag === "quillbot-extension-highlights") return;

    if (/^h[1-6]$/.test(tag)) {
      const text = collapseWs(el.text());
      if (text && !seenTitle.has(text.toLowerCase())) {
        const level = tag === "h2" ? 2 : tag === "h3" ? 3 : 2;
        const b = headingBlock(level, text);
        if (b) blocks.push(b);
      }
      if (text) seenTitle.add(text.toLowerCase());
      return;
    }

    if (tag === "p" || tag === "blockquote") {
      const html = el.html();
      const b = tag === "blockquote" ? quoteBlock(html) : paragraphBlock(html);
      if (b) blocks.push(b);
      return;
    }

    if (tag === "ul" || tag === "ol") {
      const items = el
        .children("li")
        .toArray()
        .map((li) => $(li).html());
      const b = listBlock(tag === "ol", items);
      if (b) blocks.push(b);
      return;
    }

    if (tag === "img") {
      const src = el.attr("src");
      if (src && !src.startsWith("data:")) {
        const img = resolveImage(src, {
          alt: el.attr("alt"),
          dataWidth: el.attr("data-image-width"),
          dataHeight: el.attr("data-image-height"),
          fallbackAlt: pageTitle,
        });
        const b = imageBlock(img);
        if (b) blocks.push(b);
      }
      return;
    }

    // Nicepage renders many photos as a div with an inline background-image.
    const style = el.attr("style");
    const bg = extractBgImageUrl(style);
    if (bg && !bg.startsWith("data:") && el.children().length === 0) {
      const img = resolveImage(bg, {
        alt: el.attr("alt"),
        dataWidth: el.attr("data-image-width"),
        dataHeight: el.attr("data-image-height"),
        fallbackAlt: pageTitle,
      });
      const b = imageBlock(img);
      if (b) blocks.push(b);
      return;
    }

    // Recurse into generic containers.
    el.contents().each((_, child) => {
      if (child.type === "tag") walk(child);
    });
  }

  root.children().each((_, child) => walk(child));
  return blocks;
}

// ---------------------------------------------------------------------------
// Cards block from a Nicepage repeater grid of {image, title, href?}
// ---------------------------------------------------------------------------
function cardsFromRepeater($, repeaterItems, { fallbackAlt } = {}) {
  const items = [];
  repeaterItems.each((_, itemEl) => {
    const item = $(itemEl);
    const heading = item.find("h1,h2,h3,h4,h5,h6").first();
    const title = collapseWs(heading.text());
    const itemAlt = title || fallbackAlt;

    let image = null;
    const imgTag = item.find("img").first();
    if (imgTag.length) {
      const src = imgTag.attr("src");
      if (src && !src.startsWith("data:")) {
        image = resolveImage(src, {
          alt: imgTag.attr("alt"),
          dataWidth: imgTag.attr("data-image-width"),
          dataHeight: imgTag.attr("data-image-height"),
          fallbackAlt: itemAlt,
        });
      }
    }
    if (!image) {
      const bgEl = item.find("[style*='background-image']").first();
      if (bgEl.length) {
        const bg = extractBgImageUrl(bgEl.attr("style"));
        if (bg && !bg.startsWith("data:")) {
          image = resolveImage(bg, {
            dataWidth: bgEl.attr("data-image-width"),
            dataHeight: bgEl.attr("data-image-height"),
            fallbackAlt: itemAlt,
          });
        }
      }
    }

    if (!title && !image) return;

    let href;
    const link = item.find("a[href]").first();
    if (link.length) {
      const raw = link.attr("href");
      const rewritten = rewriteLink(raw);
      if (rewritten) href = rewritten;
    }

    const bodyP = item
      .find("p")
      .toArray()
      .map((p) => plainText($(p).html()))
      .filter(Boolean)
      .join(" ");

    const card = { title: title || fallbackAlt || "" };
    if (bodyP) card.body = bodyP;
    if (image) card.image = image;
    if (href) card.href = href;
    if (card.title || card.body || card.image) items.push(card);
  });
  return items.length ? { type: "cards", items } : null;
}

// ---------------------------------------------------------------------------
// PageDoc factory
// ---------------------------------------------------------------------------
function makePageDoc({ slug, title, description, hero, blocks }) {
  const doc = {
    slug,
    title: collapseWs(title),
    description: collapseWs(description).slice(0, 160),
    blocks: blocks.filter(Boolean),
  };
  if (hero) doc.hero = hero;
  return doc;
}

function firstParagraphText(blocks) {
  const p = blocks.find((b) => b && b.type === "paragraph");
  return p ? plainText(p.html) : "";
}

function truncate(str, max) {
  const s = collapseWs(str);
  if (s.length <= max) return s;
  return s.slice(0, max - 1).replace(/\s+\S*$/, "").trim() + "\u2026";
}

// ---------------------------------------------------------------------------
// Simple narrative pages
// ---------------------------------------------------------------------------
function buildNarrativePage(slug, title, { descriptionFallback } = {}) {
  const wp = findPage(slug);
  const $ = cheerio.load(wp.content.rendered, { decodeEntities: false });
  const root = $("body > div").first().length ? $("body > div").first() : $.root();
  const blocks = nicepageNarrativeBlocks($, root, title);
  const description = truncate(firstParagraphText(blocks) || descriptionFallback || title, 160);
  return makePageDoc({ slug, title, description, blocks });
}

// ---------------------------------------------------------------------------
// President's message (adds a hero portrait)
// ---------------------------------------------------------------------------
function buildPresidentMessage() {
  const wp = findPage("president-message");
  const $ = cheerio.load(wp.content.rendered, { decodeEntities: false });
  const root = $("body > div").first();
  const title = "President's Message";
  const blocks = nicepageNarrativeBlocks($, root, title);

  let heroImage = null;
  const img = $("img").first();
  if (img.length) {
    heroImage = resolveImage(img.attr("src"), {
      alt: img.attr("alt"),
      dataWidth: img.attr("data-image-width"),
      dataHeight: img.attr("data-image-height"),
      fallbackAlt: "President, SGSM",
    });
  }
  // Drop the duplicate image block already captured generically to avoid
  // showing the portrait twice (once as hero, once inline).
  const filteredBlocks = blocks.filter((b) => !(b.type === "image" && heroImage && b.image.src === heroImage.src));

  const description = truncate(firstParagraphText(blocks), 160);
  const hero = heroImage ? { title, image: heroImage } : { title };
  return makePageDoc({ slug: "president-message", title, description, hero, blocks: filteredBlocks });
}

// ---------------------------------------------------------------------------
// Collaborative partnership — logo grid -> cards
// ---------------------------------------------------------------------------
function buildCollaborativePartnership() {
  const slug = "collaborative-partnership";
  const title = "Collaboration Partners";
  const wp = findPage(slug);
  const $ = cheerio.load(wp.content.rendered, { decodeEntities: false });
  const root = $("body > div").first();

  const items = [];
  root.find(".u-shortcode").each((_, shortcodeEl) => {
    const shortcode = $(shortcodeEl);
    const cell = shortcode.closest(".u-layout-cell");
    const img = shortcode.find("img").first();
    const heading = cell.find("h1,h2,h3,h4,h5,h6").first();
    const title2 = collapseWs(heading.text());
    if (!img.length || !title2) return;
    const image = resolveImage(img.attr("src"), {
      alt: img.attr("alt"),
      dataWidth: img.attr("data-image-width"),
      dataHeight: img.attr("data-image-height"),
      fallbackAlt: title2,
    });
    const card = { title: title2 };
    if (image) card.image = image;
    items.push(card);
  });

  const blocks = [];
  if (items.length) blocks.push({ type: "cards", items });

  const description = truncate(
    "SGSM's collaboration partners across government agencies, tourism bodies and golf associations.",
    160,
  );
  return makePageDoc({ slug, title, description, blocks });
}

// ---------------------------------------------------------------------------
// World Handicapping System — FAQ accordion
// ---------------------------------------------------------------------------
function buildWorldHandicappingSystem() {
  const slug = "world-handicapping-system";
  const title = "World Handicapping System";
  const wp = findPage(slug);
  const $ = cheerio.load(wp.content.rendered, { decodeEntities: false });
  const root = $("body > div").first();
  const blocks = [];

  // Intro heading/paragraph text that precedes the accordion (skip the page's
  // own H2 title and the accordion's inner heading text, which duplicates the
  // first FAQ question).
  const introH3 = root.find("h3").first();
  if (introH3.length) {
    const clone = introH3.clone();
    // The h3 wraps a nested <span> holding a lead-in question ("Why do you
    // need a WHS handicap") and its answer, ahead of the numbered accordion.
    // Pull that out first so it survives as its own heading + paragraph
    // instead of being discarded.
    const innerSpan = clone.find("span").first();
    let subHeading = "";
    let subBodyHtml = "";
    if (innerSpan.length) {
      subHeading = collapseWs(innerSpan.find("b").first().text());
      const bodySpan = innerSpan.find("span").first();
      subBodyHtml = bodySpan.length ? bodySpan.html() : "";
      innerSpan.remove();
    }
    const mainHeadingText = collapseWs(clone.text());
    const b = headingBlock(3, mainHeadingText.replace(/faqs on/i, "FAQs on"));
    if (b) blocks.push(b);
    if (subHeading) {
      const hb = headingBlock(4, subHeading);
      if (hb) blocks.push(hb);
    }
    if (subBodyHtml) {
      const pb = paragraphBlock(subBodyHtml);
      if (pb) blocks.push(pb);
    }
  }

  const accordionItems = [];
  root.find(".u-accordion-item").each((_, itemEl) => {
    const item = $(itemEl);
    const linkText = collapseWs(item.find(".u-accordion-link-text").first().text());
    if (!linkText) return;
    const paneBlocks = [];
    item.find(".u-accordion-pane p").each((_, pEl) => {
      const html = $(pEl).html();
      const b = paragraphBlock(html);
      if (b) paneBlocks.push(b);
    });
    if (linkText && paneBlocks.length) {
      accordionItems.push({ title: linkText.replace(/^\d+\.\s*/, ""), blocks: paneBlocks });
    }
  });
  if (accordionItems.length) blocks.push({ type: "accordion", items: accordionItems });

  const description = truncate(
    "Frequently asked questions on registering, applying for and maintaining a WHS golf handicap through SGSM.",
    160,
  );
  return makePageDoc({ slug, title, description, blocks });
}

// ---------------------------------------------------------------------------
// Contact us — office/hours/contact cards + map embed (skips the CF7 form)
// ---------------------------------------------------------------------------
function buildContactUs() {
  const slug = "contact-us";
  const title = "Contact Us";
  const wp = findPage(slug);
  const $ = cheerio.load(wp.content.rendered, { decodeEntities: false });
  const root = $("body > div").first();
  const blocks = [];

  const items = [];
  root.find(".u-repeater").first().children(".u-list-item, .u-repeater-item").each((_, itemEl) => {
    const item = $(itemEl);
    const heading = collapseWs(item.find("h1,h2,h3,h4,h5,h6").first().text());
    if (!heading) return;
    // Drop the little inline icon <img> tags before reading text; the
    // remaining lines were separated by <br> in the source (e.g. each
    // address line, or "Mon - Fri ..." / "Sat - Sun ..."), so split on
    // those rather than concatenating them with no separator at all.
    const clone = item.clone();
    clone.find("img").remove();
    const bodyP = clone.find("p").first();
    const bodyParts = splitByBr($, bodyP).map((p) => p.replace(/[,;]+$/, "").trim()).filter(Boolean);
    const body = bodyParts.join(", ");
    const card = { title: heading };
    if (body) card.body = body;
    items.push(card);
  });
  if (items.length) blocks.push({ type: "cards", items });

  const iframe = root.find("iframe").first();
  if (iframe.length) {
    let src = iframe.attr("src") || "";
    if (src.startsWith("//")) src = "https:" + src;
    if (src) blocks.push({ type: "embed", kind: "map", src, title: "SGSM Office Location" });
  }

  const description = truncate(
    "Office address, opening hours and how to reach the Senior Golfers' Society of Malaysia.",
    160,
  );
  return makePageDoc({ slug, title, description, blocks });
}

// ---------------------------------------------------------------------------
// Golfing — card list of privilege venues (links to news posts)
// ---------------------------------------------------------------------------
function buildGolfingPageAndPrivilege(categorySlug, pageSlug, pageTitle, fallbackDescription) {
  const wp = findPage(pageSlug);
  const $ = cheerio.load(wp.content.rendered, { decodeEntities: false });
  const root = $("body > div").first();
  const blocks = [];

  const repeaterItems = root.find(".u-repeater").children(".u-blog-post, .u-repeater-item");
  const cards = cardsFromRepeater($, repeaterItems, { fallbackAlt: pageTitle });
  if (cards) blocks.push(cards);

  const privRefs = [];
  root.find(".u-blog-post, .u-repeater-item").each((_, itemEl) => {
    const item = $(itemEl);
    const link = item.find('a[href*="news-details/"]').first();
    if (!link.length) return;
    const idMatch = (link.attr("href") || "").match(/news-details\/(\d+)/);
    if (!idMatch) return;
    const id = Number(idMatch[1]);
    const slug = postIdToSlug.get(id);
    if (!slug) return;
    const title = collapseWs(item.find("h1,h2,h3,h4,h5,h6").first().text());
    const imgTag = item.find("img").first();
    let image = null;
    if (imgTag.length) {
      const src = imgTag.attr("src");
      if (src && !src.startsWith("data:")) {
        image = resolveImage(src, {
          alt: imgTag.attr("alt"),
          dataWidth: imgTag.attr("data-image-width"),
          dataHeight: imgTag.attr("data-image-height"),
          fallbackAlt: title,
        });
      }
    }
    if (!seenPrivIds.has(id)) {
      seenPrivIds.add(id);
    }
    privRefs.push({ id, slug, title, image: image || null, summary: postSummary(id) });
  });

  const description = truncate(fallbackDescription, 160);
  const pageDoc = makePageDoc({ slug: pageSlug, title: pageTitle, description, blocks });
  return { pageDoc, privRefs };
}

const seenPrivIds = new Set();

function postSummary(id) {
  const post = wpPosts.find((p) => p.id === id);
  if (!post) return "";
  const excerptText = plainText(post.excerpt && post.excerpt.rendered);
  return truncate(excerptText.replace(/\s*\u2026\s*$/, "\u2026").replace(/\[\u2026\]$/, "\u2026"), 200);
}

// ---------------------------------------------------------------------------
// Under-construction privilege pages (hotels-and-restaurants, others)
// ---------------------------------------------------------------------------
function buildUnderConstructionPage(slug, title) {
  const wp = findPage(slug);
  const $ = cheerio.load(wp.content.rendered, { decodeEntities: false });
  const root = $("body > div").first();
  const blocks = [];

  const banner = root.find("section").eq(1);
  const headline = collapseWs(banner.find("h1").first().text());
  const sub = collapseWs(banner.find("h3").first().text());
  if (headline) {
    const b = headingBlock(2, headline);
    if (b) blocks.push(b);
  }
  if (sub) {
    const b = paragraphBlock(sub);
    if (b) blocks.push(b);
  }

  const description = truncate(sub || headline || title, 160);
  return makePageDoc({ slug, title, description, blocks });
}

// ---------------------------------------------------------------------------
// Partners and sponsors — page blocks + partners.json
// ---------------------------------------------------------------------------
function buildPartnersAndSponsors() {
  const slug = "partners-and-sponsors";
  const wp = findPage(slug);
  const $ = cheerio.load(wp.content.rendered, { decodeEntities: false });
  const root = $("body > div").first();

  const titleParts = splitByBr($, root.find("section").first().find("h2").first());
  const title = titleParts.find((p) => !/^\d{4}\s*-\s*\d{4}$/.test(p)) || "Partners and Sponsors";
  const intro = titleParts.find((p) => /^\d{4}\s*-\s*\d{4}$/.test(p));

  const blocks = [];
  const partners = [];

  root
    .find("section")
    .slice(1)
    .each((_, sectionEl) => {
      const section = $(sectionEl);
      const groupTitle = collapseWs(section.find("h2").first().text());
      const items = section.find(".u-repeater").children(".u-list-item, .u-repeater-item");
      const cards = cardsFromRepeater($, items, { fallbackAlt: groupTitle || title });
      if (groupTitle) {
        const hb = headingBlock(3, groupTitle);
        if (hb) blocks.push(hb);
      }
      if (cards) blocks.push(cards);

      items.each((_, itemEl) => {
        const item = $(itemEl);
        const img = item.find("img").first();
        const heading = collapseWs(item.find("h1,h2,h3,h4,h5,h6").first().text());
        if (!heading) return;
        let logo = null;
        if (img.length) {
          const src = img.attr("src");
          if (src && !src.startsWith("data:")) {
            logo = resolveImage(src, {
              alt: img.attr("alt"),
              dataWidth: img.attr("data-image-width"),
              dataHeight: img.attr("data-image-height"),
              fallbackAlt: heading,
            });
          }
        }
        const partner = { name: heading, logo: logo || null };
        if (groupTitle) partner.note = groupTitle;
        partners.push(partner);
      });
    });

  const description = truncate(
    `SGSM's ${intro ? intro + " " : ""}partners and sponsors, including collaboration partners and hole-in-one sponsors.`,
    160,
  );
  const pageDoc = makePageDoc({ slug, title, description, blocks });

  const partnersDoc = { title, ...(intro ? { intro } : {}), partners };
  return { pageDoc, partnersDoc };
}

// ---------------------------------------------------------------------------
// Home — carousel gallery + notice
// ---------------------------------------------------------------------------
function buildHome() {
  const slug = "home";
  const title = "Home";
  const wp = findPage(slug);
  const $ = cheerio.load(wp.content.rendered, { decodeEntities: false });
  const root = $("body > div").first();
  const blocks = [];

  const images = [];
  root.find(".u-carousel-item").each((_, slideEl) => {
    const slide = $(slideEl);
    const imgHolder = slide.find("[style*='background-image']").first();
    if (!imgHolder.length) return;
    const bg = extractBgImageUrl(imgHolder.attr("style"));
    if (!bg || bg.startsWith("data:")) return;
    const image = resolveImage(bg, {
      dataWidth: imgHolder.attr("data-image-width"),
      dataHeight: imgHolder.attr("data-image-height"),
      fallbackAlt: "SGSM",
    });
    if (image) images.push(image);
  });
  if (images.length) blocks.push({ type: "gallery", images });

  // The 7th slide is a text "Notice to members" card rather than an image.
  const noticeSlide = root.find(".u-carousel-item h2").filter((_, h) => /notice to members/i.test($(h).text())).first();
  if (noticeSlide.length) {
    const slide = noticeSlide.closest(".u-carousel-item");
    const hb = headingBlock(2, noticeSlide.text());
    if (hb) blocks.push(hb);
    const img = slide.find("img").first();
    if (img.length) {
      const src = img.attr("src");
      if (src && !src.startsWith("data:")) {
        const image = resolveImage(src, {
          alt: img.attr("alt"),
          dataWidth: img.attr("data-image-width"),
          dataHeight: img.attr("data-image-height"),
          fallbackAlt: "Notice to members",
        });
        const b = imageBlock(image);
        if (b) blocks.push(b);
      }
    }
    const bq = slide.find("blockquote").first();
    if (bq.length) {
      const b = quoteBlock(bq.html());
      if (b) blocks.push(b);
    }
    const p = slide.find("p").first();
    if (p.length) {
      const b = paragraphBlock(p.html());
      if (b) blocks.push(b);
    }
  }

  const description = truncate(
    "Senior Golfers' Society of Malaysia — news, events and privileges for members aged 55 and above.",
    160,
  );
  return makePageDoc({ slug, title, description, blocks });
}

// ---------------------------------------------------------------------------
// News listing page (content lives in content/news.json; this PageDoc is
// just the route's own title/description).
// ---------------------------------------------------------------------------
function buildNewsPageDoc() {
  // The source "news" page is just a Nicepage post-listing widget (title +
  // repeater of the 3 "news"-category posts) — the actual listing is served
  // from content/news.json at render time, so all we lift from the source
  // markup here is its own section heading.
  const wp = findPage("news");
  const $ = cheerio.load(wp.content.rendered, { decodeEntities: false });
  const root = $("body > div").first();
  const headingText = collapseWs(root.find("h2").first().text()) || "News";
  const blocks = [headingBlock(2, headingText)].filter(Boolean);
  return makePageDoc({
    slug: "news",
    title: "News",
    description: "Latest news and announcements from the Senior Golfers' Society of Malaysia.",
    blocks,
  });
}

// ---------------------------------------------------------------------------
// Post body (Gutenberg) -> Block[]
// ---------------------------------------------------------------------------
function postBodyToBlocks($, root) {
  const blocks = [];

  function columnsToTable(node) {
    const columnsEl = $(node);
    const columns = columnsEl.children(".wp-block-column");
    if (!columns.length) return null;
    const head = [];
    const row = [];
    columns.each((_, colEl) => {
      const col = $(colEl);
      const paras = col.children("p").toArray();
      let headText = "";
      let bodyParts = [];
      paras.forEach((pEl, idx) => {
        const html = $(pEl).html();
        const text = plainText(html);
        if (idx === 0 && /^<strong>[^<]*<\/strong>$/i.test(stripToAllowedInline(html))) {
          headText = text;
        } else if (text) {
          bodyParts.push(stripToAllowedInline(html));
        }
      });
      head.push(headText || "");
      row.push(bodyParts.join("<br>"));
    });
    if (!row.some(Boolean)) return null;
    return { type: "table", head, rows: [row] };
  }

  function walk(node) {
    const el = $(node);
    const tag = node.tagName ? node.tagName.toLowerCase() : null;
    if (!tag) return;

    if (["script", "style", "svg"].includes(tag)) return;
    if (el.hasClass && el.hasClass("wp-block-spacer")) return;
    if (el.hasClass && el.hasClass("wp-block-separator")) return;
    if (el.hasClass && el.hasClass("wp-block-buttons")) return; // "<- Back" nav only

    if (el.hasClass && el.hasClass("wp-block-columns")) {
      const table = columnsToTable(node);
      if (table) blocks.push(table);
      return;
    }

    if (el.hasClass && el.hasClass("wp-block-file")) {
      const link = el.find("a[href]").first();
      const label = collapseWs(link.text()) || "Download";
      const href = link.attr("href");
      if (href) {
        const local = toLocalFile(href) || href;
        const b = paragraphBlock(`<a href="${local}">${label}</a>`);
        if (b) blocks.push(b);
      }
      return;
    }

    if (/^h[1-6]$/.test(tag)) {
      const level = tag === "h2" ? 2 : tag === "h3" ? 3 : tag === "h1" ? 2 : 4;
      const b = headingBlock(level, el.text());
      if (b) blocks.push(b);
      return;
    }

    if (tag === "p") {
      const b = paragraphBlock(el.html());
      if (b) blocks.push(b);
      return;
    }

    if (tag === "blockquote") {
      const b = quoteBlock(el.html());
      if (b) blocks.push(b);
      return;
    }

    if (tag === "ul" || tag === "ol") {
      const items = el
        .children("li")
        .toArray()
        .map((li) => $(li).html());
      const b = listBlock(tag === "ol", items);
      if (b) blocks.push(b);
      return;
    }

    if (tag === "img") {
      const src = el.attr("src");
      if (src && !src.startsWith("data:")) {
        const image = resolveImage(src, {
          alt: el.attr("alt"),
          dataWidth: el.attr("width"),
          dataHeight: el.attr("height"),
        });
        const b = imageBlock(image);
        if (b) blocks.push(b);
      }
      return;
    }

    if (tag === "figure") {
      const img = el.find("img").first();
      if (img.length) {
        const src = img.attr("src");
        if (src && !src.startsWith("data:")) {
          const image = resolveImage(src, {
            alt: img.attr("alt"),
            dataWidth: img.attr("width"),
            dataHeight: img.attr("height"),
          });
          const caption = el.find("figcaption").first().text();
          const b = imageBlock(image, caption);
          if (b) blocks.push(b);
        }
      }
      return;
    }

    if (tag === "hr") return;

    // Recurse into generic wrapper elements (divs, wp-block-group, etc.)
    el.contents().each((_, child) => {
      if (child.type === "tag") walk(child);
    });
  }

  root.children().each((_, child) => walk(child));
  return blocks;
}

// ---------------------------------------------------------------------------
// content/news.json — full body for all 14 posts
// ---------------------------------------------------------------------------
function buildNews() {
  const CATEGORY_NAME = { 38: "news", 60: "golfing" };
  const news = wpPosts
    .slice()
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .map((post) => {
      const $ = cheerio.load(post.content.rendered, { decodeEntities: false });
      const root = $.root();
      const blocks = postBodyToBlocks($, root);

      let image = null;
      const firstImageBlock = blocks.find((b) => b.type === "image");
      if (firstImageBlock) {
        image = firstImageBlock.image;
      }

      const category = CATEGORY_NAME[post.categories && post.categories[0]] || "news";
      const excerptText = truncate(plainText(post.excerpt && post.excerpt.rendered), 200);

      return {
        id: post.id,
        slug: post.slug,
        title: collapseWs(post.title && post.title.rendered),
        date: post.date.slice(0, 10),
        excerpt: excerptText,
        category,
        image,
        blocks,
      };
    });
  return news;
}

// ---------------------------------------------------------------------------
// content/council.json
// ---------------------------------------------------------------------------
// `parts` are the individual lines of a role paragraph, already split on the
// source's own <br> tags (see splitByBr) \u2014 e.g. ["Secretary",
// "Negeri Sembilan Representative", "(2024-2026)"]. The trailing line is the
// year range when present; everything else joins back into the role.
function roleYearsFromParts(parts) {
  let roleParts = parts.slice();
  let years;
  const last = roleParts[roleParts.length - 1];
  const yearMatch = last && last.match(/^\(?\s*(\d{4}\s*-\s*\d{2,4})\s*\)?$/);
  if (yearMatch) {
    years = yearMatch[1].replace(/\s+/g, "");
    roleParts = roleParts.slice(0, -1);
  }
  const role = roleParts.join(", ").replace(/[,\s]+$/, "").trim();
  return { role, years };
}

function buildCouncil() {
  const wp = findPage("council");
  const $ = cheerio.load(wp.content.rendered, { decodeEntities: false });
  const root = $("body > div").first();
  const sections = root.find("> section").toArray();

  const groups = [];
  let currentGroupTitle = null;
  let currentMembers = [];

  function flush() {
    if (currentGroupTitle && currentMembers.length) {
      groups.push({ title: currentGroupTitle, members: currentMembers });
    }
    currentMembers = [];
  }

  let pageTitleSeen = false;
  for (const sectionEl of sections) {
    const section = $(sectionEl);
    const h2 = collapseWs(section.find("> div > h2").first().text() || section.find("h2").first().text());
    const hasItems = section.find(".u-repeater-item").length > 0;

    if (!pageTitleSeen && !hasItems) {
      pageTitleSeen = true;
      continue; // banner section with the page's own title
    }

    if (h2 === "Officers") {
      flush();
      currentGroupTitle = "Officers";
    } else if (h2 === "Council Members") {
      flush();
      currentGroupTitle = "Council Members";
    } else if (!currentGroupTitle) {
      currentGroupTitle = "Council Members";
    }

    section.find(".u-repeater-item").each((_, itemEl) => {
      const item = $(itemEl);
      const nameEl = item.find("h4,h5").first();
      const name = collapseWs(nameEl.text());
      if (!name) return;
      const roleP = item.find("p").first();
      const { role, years } = roleYearsFromParts(splitByBr($, roleP));

      let image = null;
      const bgEl = item.find("[style*='background-image']").first();
      if (bgEl.length) {
        const bg = extractBgImageUrl(bgEl.attr("style"));
        if (bg && !bg.startsWith("data:")) {
          image = resolveImage(bg, {
            dataWidth: bgEl.attr("data-image-width"),
            dataHeight: bgEl.attr("data-image-height"),
            fallbackAlt: name,
          });
        }
      }

      const member = { name, role: role || "" };
      if (years) member.years = years;
      member.image = image || null;
      currentMembers.push(member);
    });
  }
  flush();

  return {
    title: "Councillors Members 2025 - 2027 & Officers",
    groups,
  };
}

// ---------------------------------------------------------------------------
// content/committees.json (from the "event-details" / Working Committees page)
// ---------------------------------------------------------------------------
function buildCommittees() {
  const wp = findPage("event-details");
  const $ = cheerio.load(wp.content.rendered, { decodeEntities: false });
  const root = $("body > div").first();

  const committees = [];
  root.find(".u-accordion-item").each((_, itemEl) => {
    const item = $(itemEl);
    const name = collapseWs(item.find(".u-accordion-link-text").first().text());
    if (!name) return;
    const h3 = item.find(".u-accordion-pane h3").first();
    if (!h3.length) return;
    // h3 text is "Chairman<br>Name" (order may vary slightly); the role
    // is always "Chairman" and everything else is the member's name.
    const parts = splitByBr($, h3);
    const role = parts.find((p) => /^chairman$/i.test(p)) || "Chairman";
    const memberName = parts.find((p) => !/^chairman$/i.test(p));
    if (!memberName) return;
    committees.push({ name, members: [{ name: memberName, role }] });
  });

  return { title: "Working Committees", committees };
}

// ---------------------------------------------------------------------------
// content/past-presidents.json
// ---------------------------------------------------------------------------
function buildPastPresidents() {
  const wp = findPage("post-presidents");
  const $ = cheerio.load(wp.content.rendered, { decodeEntities: false });
  const rows = [];
  $("table tbody tr").each((_, trEl) => {
    const cells = $(trEl)
      .find("td")
      .toArray()
      .map((td) => collapseWs($(td).text()));
    if (cells.length < 3) return;
    const no = parseInt(cells[0], 10);
    const name = cells[1];
    const years = cells[2];
    if (!Number.isFinite(no) || !name) return;
    rows.push({ no, name, years });
  });
  return { title: "Past Presidents", rows };
}

// ---------------------------------------------------------------------------
// content/patrons.json
// ---------------------------------------------------------------------------
function buildPatrons() {
  const wp = findPage("patrons-and-honorary-members");
  const $ = cheerio.load(wp.content.rendered, { decodeEntities: false });
  const root = $("body > div").first();
  const groups = [];

  root
    .find("> section")
    .slice(1)
    .each((_, sectionEl) => {
      const section = $(sectionEl);
      const groupTitle = collapseWs(section.find("> div > h2").first().text());
      if (!groupTitle) return;
      const people = [];
      section.find(".u-repeater-item").each((_, itemEl) => {
        const item = $(itemEl);
        const img = item.find("img").first();
        const headingEl = item.find("h4,h5,h6").first();
        if (!headingEl.length) return;
        // Layout is consistently: honorific style/rank line, then the
        // person's actual name, then (optionally) a run of post-nominal
        // honours/decorations — each originally its own <br>-separated line.
        const segments = splitByBr($, headingEl);
        let name;
        let titleRest;
        if (segments.length >= 2 && /^(yang|duli)\b/i.test(segments[0])) {
          name = collapseWs(`${segments[0]} ${segments[1]}`);
          titleRest = segments.slice(2).join(", ");
        } else {
          name = segments[0] || "";
          titleRest = segments.slice(1).join(", ");
        }

        let image = null;
        if (img.length) {
          const src = img.attr("src");
          if (src && !src.startsWith("data:")) {
            image = resolveImage(src, {
              alt: img.attr("alt"),
              dataWidth: img.attr("data-image-width"),
              dataHeight: img.attr("data-image-height"),
              fallbackAlt: name,
            });
          }
        }

        const person = { name };
        if (titleRest) person.title = titleRest;
        person.image = image || null;
        people.push(person);
      });
      if (people.length) groups.push({ title: groupTitle, people });
    });

  return { title: "Patrons and Honorary Members", groups };
}

// ---------------------------------------------------------------------------
// Write helpers
// ---------------------------------------------------------------------------
function writeJson(filePath, data) {
  const json = JSON.stringify(data, null, 2) + "\n";
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, json, "utf8");
}

function writePageDoc(doc) {
  writeJson(path.join(PAGES_DIR, `${doc.slug}.json`), doc);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
function main() {
  const counts = {};

  // Simple narrative pages
  writePageDoc(buildNarrativePage("about-us", "About SGSM"));
  writePageDoc(buildNarrativePage("our-history", "SGSM's History"));
  writePageDoc(buildNarrativePage("sgsm-building", "SGSM Building"));
  writePageDoc(buildPresidentMessage());
  writePageDoc(buildUnderConstructionPage("hotels-and-restaurants", "Hotels and Restaurants"));
  writePageDoc(buildUnderConstructionPage("others", "Others"));

  // Specialised pages
  writePageDoc(buildCollaborativePartnership());
  writePageDoc(buildWorldHandicappingSystem());
  writePageDoc(buildContactUs());
  writePageDoc(buildHome());
  writePageDoc(buildNewsPageDoc());

  const { pageDoc: golfingDoc, privRefs: golfingPrivs } = buildGolfingPageAndPrivilege(
    "golfing",
    "golfing",
    "Golfing",
    "Golfing privileges for SGSM members at partner clubs and resorts across Malaysia.",
  );
  writePageDoc(golfingDoc);

  const { pageDoc: partnersDoc, partnersDoc: partnersJson } = buildPartnersAndSponsors();
  writePageDoc(partnersDoc);

  // content/patrons.json, council.json, past-presidents.json, committees.json
  const patrons = buildPatrons();
  const council = buildCouncil();
  const pastPresidents = buildPastPresidents();
  const committees = buildCommittees();

  writeJson(path.join(CONTENT_DIR, "patrons.json"), patrons);
  writeJson(path.join(CONTENT_DIR, "council.json"), council);
  writeJson(path.join(CONTENT_DIR, "past-presidents.json"), pastPresidents);
  writeJson(path.join(CONTENT_DIR, "committees.json"), committees);
  writeJson(path.join(CONTENT_DIR, "partners.json"), partnersJson);

  // content/news.json
  const news = buildNews();
  writeJson(path.join(CONTENT_DIR, "news.json"), news);

  // content/privileges.json
  const privileges = {
    golfing: golfingPrivs,
    "hotels-and-restaurants": [],
    others: [],
  };
  writeJson(path.join(CONTENT_DIR, "privileges.json"), privileges);

  counts["pages/about-us.json"] = 1;
  counts["pages/our-history.json"] = 1;
  counts["pages/sgsm-building.json"] = 1;
  counts["pages/president-message.json"] = 1;
  counts["pages/hotels-and-restaurants.json"] = 1;
  counts["pages/others.json"] = 1;
  counts["pages/collaborative-partnership.json"] = 1;
  counts["pages/world-handicapping-system.json"] = 1;
  counts["pages/contact-us.json"] = 1;
  counts["pages/home.json"] = 1;
  counts["pages/news.json"] = 1;
  counts["pages/golfing.json"] = 1;
  counts["pages/partners-and-sponsors.json"] = 1;
  counts["news.json"] = news.length;
  counts["privileges.json (golfing)"] = golfingPrivs.length;
  counts["council.json (groups)"] = council.groups.length;
  counts["council.json (members)"] = council.groups.reduce((n, g) => n + g.members.length, 0);
  counts["past-presidents.json (rows)"] = pastPresidents.rows.length;
  counts["committees.json (committees)"] = committees.committees.length;
  counts["patrons.json (groups)"] = patrons.groups.length;
  counts["patrons.json (people)"] = patrons.groups.reduce((n, g) => n + g.people.length, 0);
  counts["partners.json (partners)"] = partnersJson.partners.length;

  console.log("extract-pages.mjs — record counts:");
  for (const [k, v] of Object.entries(counts)) {
    console.log(`  ${k}: ${v}`);
  }
}

main();
