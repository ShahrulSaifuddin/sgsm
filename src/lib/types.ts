/**
 * Shared TypeScript types — owned by the design-system worker
 * (.foreman/schemas.md §A.2). Every other worker imports from here and must
 * not redefine these locally.
 */

export type ImageRef = {
  src: string; // "/images/2022/10/impian-tb.png"
  alt: string; // never empty for meaningful images; "" only if decorative
  width: number;
  height: number;
  blurDataURL?: string;
};

export type Block =
  | { type: "paragraph"; html: string } // only <strong><em><b><i><a><br><sup><sub> survive
  | { type: "heading"; level: 2 | 3 | 4; text: string }
  | { type: "list"; ordered: boolean; items: string[] } // items carry inline html
  | { type: "image"; image: ImageRef; caption?: string }
  | { type: "gallery"; images: ImageRef[] }
  | { type: "table"; caption?: string; head: string[]; rows: string[][] }
  | { type: "quote"; html: string; attribution?: string }
  | { type: "cards"; items: CardItem[] }
  | { type: "accordion"; items: { title: string; blocks: Block[] }[] }
  | { type: "embed"; kind: "map" | "pdf"; src: string; title: string };

export type CardItem = {
  title: string;
  subtitle?: string;
  body?: string;
  image?: ImageRef;
  href?: string;
};

export type PageDoc = {
  slug: string;
  title: string;
  seoTitle?: string;
  description: string; // <=160 chars, used as meta description
  hero?: { eyebrow?: string; title: string; subtitle?: string; image?: ImageRef };
  blocks: Block[];
};

/* ---------------------------------------------------------------------- */
/* Site configuration (content/site.json) — used by layout components     */
/* ---------------------------------------------------------------------- */

export type NavItem = {
  label: string;
  href: string;
  children?: NavItem[];
};

export type HoursEntry = {
  label: string;
  value: string;
};

export type SiteAddress = {
  lines: string[];
  city: string;
  postcode: string;
  country: string;
};

export type SiteConfig = {
  name: string;
  shortName: string;
  tagline: string;
  founded: string;
  foundedNote?: string;
  membershipAge?: number;
  memberCount?: string;
  address: SiteAddress;
  email: string;
  phone: string;
  phoneHref?: string;
  hours: HoursEntry[];
  nav: NavItem[];
  footerNav: NavItem[];
  cta: { label: string; href: string };
  affiliations?: string[];
  registration?: string;
};

/* ---------------------------------------------------------------------- */
/* Shared small UI types                                                  */
/* ---------------------------------------------------------------------- */

/** A single crumb in a breadcrumb trail; the last item is usually the current page (no href). */
export type BreadcrumbItem = {
  label: string;
  href?: string;
};
