/**
 * Typed loaders for the JSON content that stays file-based (everything under
 * `content/` except events/venues/news/gallery/downloads, which are seeded
 * into SQLite -- see `src/lib/db/queries.ts` for those).
 *
 * Every loader parses its source file at most once per process (cached in a
 * module-level map) and merges `blurDataURL` from `content/media-manifest.json`
 * into every `ImageRef` it returns, so components never have to think about
 * the manifest themselves.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import type { Block, CardItem, ImageRef, PageDoc, SiteConfig } from "./types";

const CONTENT_DIR = path.join(process.cwd(), "content");

/* -------------------------------------------------------------------------- */
/* Generic, memoized JSON file reader                                         */
/* -------------------------------------------------------------------------- */

const fileCache = new Map<string, unknown>();

function readJson<T>(relativePath: string): T {
  const cached = fileCache.get(relativePath);
  if (cached !== undefined) return cached as T;

  const fullPath = path.join(CONTENT_DIR, relativePath);
  const raw = readFileSync(fullPath, "utf-8");
  const parsed = JSON.parse(raw) as T;
  fileCache.set(relativePath, parsed);
  return parsed;
}

/* -------------------------------------------------------------------------- */
/* Media manifest / image resolution                                          */
/* -------------------------------------------------------------------------- */

export interface MediaFormatVariant {
  w: number;
  src: string;
}

export interface MediaManifestEntry {
  width: number;
  height: number;
  bytes: number;
  blurDataURL?: string;
  formats?: {
    avif?: MediaFormatVariant[];
    webp?: MediaFormatVariant[];
  };
}

type MediaManifest = Record<string, MediaManifestEntry>;

function getMediaManifest(): MediaManifest {
  try {
    return readJson<MediaManifest>("media-manifest.json");
  } catch {
    // The manifest may briefly be absent/partial while the asset pipeline is
    // still populating content/. Resolving to "no data" degrades gracefully
    // (images still render, just without a blur placeholder or size hints).
    return {};
  }
}

/** Looks up the media manifest entry for a local `/images/...` path, if any. */
export function resolveImage(src: string): MediaManifestEntry | null {
  const manifest = getMediaManifest();
  return manifest[src] ?? null;
}

function hydrateImage<T extends ImageRef | null | undefined>(image: T): T {
  if (!image) return image;
  const entry = resolveImage(image.src);
  if (!entry?.blurDataURL || image.blurDataURL) return image;
  return { ...image, blurDataURL: entry.blurDataURL };
}

function hydrateImages(images: ImageRef[]): ImageRef[] {
  return images.map((image) => hydrateImage(image));
}

/* -------------------------------------------------------------------------- */
/* Block[] hydration (walks nested blocks for images/galleries/cards/accordion)*/
/* -------------------------------------------------------------------------- */

function hydrateCardItem(item: CardItem): CardItem {
  if (!item.image) return item;
  return { ...item, image: hydrateImage(item.image) };
}

function hydrateBlock(block: Block): Block {
  switch (block.type) {
    case "image":
      return { ...block, image: hydrateImage(block.image) };
    case "gallery":
      return { ...block, images: hydrateImages(block.images) };
    case "cards":
      return { ...block, items: block.items.map(hydrateCardItem) };
    case "accordion":
      return {
        ...block,
        items: block.items.map((item) => ({ ...item, blocks: hydrateBlocks(item.blocks) })),
      };
    default:
      return block;
  }
}

function hydrateBlocks(blocks: Block[]): Block[] {
  return blocks.map(hydrateBlock);
}

/* -------------------------------------------------------------------------- */
/* site.json                                                                   */
/* -------------------------------------------------------------------------- */

export function getSiteConfig(): SiteConfig {
  return readJson<SiteConfig>("site.json");
}

/* -------------------------------------------------------------------------- */
/* pages/<slug>.json                                                           */
/* -------------------------------------------------------------------------- */

export function getPage(slug: string): PageDoc | null {
  try {
    const doc = readJson<PageDoc>(`pages/${slug}.json`);
    return {
      ...doc,
      hero: doc.hero ? { ...doc.hero, image: hydrateImage(doc.hero.image) } : doc.hero,
      blocks: hydrateBlocks(doc.blocks),
    };
  } catch {
    return null;
  }
}

/* -------------------------------------------------------------------------- */
/* council.json                                                                */
/* -------------------------------------------------------------------------- */

export interface CouncilMember {
  name: string;
  role: string;
  years?: string;
  image: ImageRef | null;
}

export interface CouncilGroup {
  title: string;
  members: CouncilMember[];
}

export interface CouncilDoc {
  title: string;
  subtitle?: string;
  groups: CouncilGroup[];
}

export function getCouncil(): CouncilDoc {
  const doc = readJson<CouncilDoc>("council.json");
  return {
    ...doc,
    groups: doc.groups.map((group) => ({
      ...group,
      members: group.members.map((member) => ({ ...member, image: hydrateImage(member.image) })),
    })),
  };
}

/* -------------------------------------------------------------------------- */
/* past-presidents.json                                                       */
/* -------------------------------------------------------------------------- */

export interface PastPresidentRow {
  no: number;
  name: string;
  years: string;
}

export interface PastPresidentsDoc {
  title: string;
  rows: PastPresidentRow[];
}

export function getPastPresidents(): PastPresidentsDoc {
  return readJson<PastPresidentsDoc>("past-presidents.json");
}

/* -------------------------------------------------------------------------- */
/* committees.json                                                             */
/* -------------------------------------------------------------------------- */

export interface CommitteeMember {
  name: string;
  role?: string;
}

export interface Committee {
  name: string;
  members: CommitteeMember[];
}

export interface CommitteesDoc {
  title: string;
  committees: Committee[];
}

export function getCommittees(): CommitteesDoc {
  return readJson<CommitteesDoc>("committees.json");
}

/* -------------------------------------------------------------------------- */
/* patrons.json                                                                */
/* -------------------------------------------------------------------------- */

export interface PatronPerson {
  name: string;
  title?: string;
  image: ImageRef | null;
}

export interface PatronGroup {
  title: string;
  people: PatronPerson[];
}

export interface PatronsDoc {
  title: string;
  groups: PatronGroup[];
}

export function getPatrons(): PatronsDoc {
  const doc = readJson<PatronsDoc>("patrons.json");
  return {
    ...doc,
    groups: doc.groups.map((group) => ({
      ...group,
      people: group.people.map((person) => ({ ...person, image: hydrateImage(person.image) })),
    })),
  };
}

/* -------------------------------------------------------------------------- */
/* partners.json                                                              */
/* -------------------------------------------------------------------------- */

export interface Partner {
  name: string;
  logo: ImageRef | null;
  url?: string;
  note?: string;
}

export interface PartnersDoc {
  title: string;
  intro?: string;
  partners: Partner[];
}

export function getPartners(): PartnersDoc {
  const doc = readJson<PartnersDoc>("partners.json");
  return {
    ...doc,
    partners: doc.partners.map((partner) => ({ ...partner, logo: hydrateImage(partner.logo) })),
  };
}

/* -------------------------------------------------------------------------- */
/* privileges.json                                                            */
/* -------------------------------------------------------------------------- */

export interface PrivilegeRef {
  id: number;
  slug: string;
  title: string;
  image: ImageRef | null;
  summary: string;
}

export interface PrivilegesDoc {
  golfing: PrivilegeRef[];
  "hotels-and-restaurants": PrivilegeRef[];
  others: PrivilegeRef[];
}

function hydratePrivilegeRefs(refs: PrivilegeRef[]): PrivilegeRef[] {
  return refs.map((ref) => ({ ...ref, image: hydrateImage(ref.image) }));
}

export function getPrivileges(): PrivilegesDoc {
  const doc = readJson<PrivilegesDoc>("privileges.json");
  return {
    golfing: hydratePrivilegeRefs(doc.golfing),
    "hotels-and-restaurants": hydratePrivilegeRefs(doc["hotels-and-restaurants"]),
    others: hydratePrivilegeRefs(doc.others),
  };
}
