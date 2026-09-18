# Appendix A — Content schemas (authoritative; every worker shares these)

Read together with `.foreman/contract.md`. Where the two disagree, this file wins for
data shapes and the contract wins for everything else.

## A.1 The image-path rule (decouples the asset worker from the content workers)

Every source image URL looks like
`https://sgsm.com.my/prod/wp-content/uploads/<YYYY>/<MM>/<file>`.

The asset pipeline and the content extractors each compute the local path with this
**pure, deterministic** function. Implement it identically in each script — no shared
state, no lookup table, no ordering dependency between workers:

```js
// "https://sgsm.com.my/prod/wp-content/uploads/2022/10/Impian-TB-300x201.png"
//   -> "/images/2022/10/impian-tb.png"
export function toLocalImage(url) {
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
  return `/images/${m[1]}/${m[2]}/${base}${ext}`;
}
```

Apply the suffix strip **repeatedly is not needed** — one pass, in the order above.
All WordPress variants of one upload therefore resolve to a single local path.
Images that are not under `/wp-content/uploads/` (base64 URIs, plugin sprites,
spacer GIFs, external logos) are dropped entirely — they are never referenced.

PDFs and other documents map the same way but into `/files/<YYYY>/<MM>/<name>.pdf`.

## A.2 Shared TypeScript types

Owned by the design-system worker, written to `src/lib/types.ts`. Everyone else
imports from there and must not redefine these locally.

```ts
export type ImageRef = {
  src: string;          // "/images/2022/10/impian-tb.png"
  alt: string;          // never empty for meaningful images; "" only if decorative
  width: number;
  height: number;
  blurDataURL?: string;
};

export type Block =
  | { type: 'paragraph'; html: string }   // only <strong><em><b><i><a><br><sup><sub> survive
  | { type: 'heading'; level: 2 | 3 | 4; text: string }
  | { type: 'list'; ordered: boolean; items: string[] }   // items carry inline html
  | { type: 'image'; image: ImageRef; caption?: string }
  | { type: 'gallery'; images: ImageRef[] }
  | { type: 'table'; caption?: string; head: string[]; rows: string[][] }
  | { type: 'quote'; html: string; attribution?: string }
  | { type: 'cards'; items: CardItem[] }
  | { type: 'accordion'; items: { title: string; blocks: Block[] }[] }
  | { type: 'embed'; kind: 'map' | 'pdf'; src: string; title: string };

export type CardItem = {
  title: string; subtitle?: string; body?: string; image?: ImageRef; href?: string;
};

export type PageDoc = {
  slug: string;
  title: string;
  seoTitle?: string;
  description: string;                 // <=160 chars, used as meta description
  hero?: { eyebrow?: string; title: string; subtitle?: string; image?: ImageRef };
  blocks: Block[];
};
```

## A.3 Files and their shapes

| File | Shape |
|---|---|
| `content/site.json` | `{ name, shortName, tagline, founded, address:{lines:string[],city,postcode,country}, email, phone, hours:{label,value}[], nav:NavItem[], footerNav:NavItem[] }` with `NavItem = { label, href, children?: NavItem[] }` |
| `content/pages/<slug>.json` | one `PageDoc` per content route in contract §4 |
| `content/news.json` | `{ id:number, slug, title, date:"YYYY-MM-DD", excerpt, category:"news"\|"golfing"\|"hotels-and-restaurants"\|"others", image:ImageRef\|null, blocks:Block[] }[]` |
| `content/privileges.json` | `{ golfing:PrivRef[], "hotels-and-restaurants":PrivRef[], others:PrivRef[] }` where `PrivRef = { id, slug, title, image:ImageRef\|null, summary }`; every `id`/`slug` must also exist in `news.json` |
| `content/council.json` | `{ title, subtitle?, groups:{ title, members:{ name, role, years?, image:ImageRef\|null }[] }[] }` |
| `content/past-presidents.json` | `{ title, rows:{ no:number, name, years }[] }` |
| `content/committees.json` | `{ title, committees:{ name, members:{ name, role? }[] }[] }` |
| `content/patrons.json` | `{ title, groups:{ title, people:{ name, title?, image:ImageRef\|null }[] }[] }` |
| `content/partners.json` | `{ title, intro?, partners:{ name, logo:ImageRef\|null, url?, note? }[] }` |
| `content/events.json` | `{ id, slug, title, startDate:"YYYY-MM-DDTHH:mm:ss", endDate, allDay:boolean, cost, website, image:ImageRef\|null, venueSlug:string\|null, categories:string[], excerpt, blocks:Block[] }[]` |
| `content/venues.json` | `{ id, slug, name, address, city, province, zip, country, mapQuery }[]` |
| `content/gallery.json` | `{ albums:{ slug, title, date?:"YYYY-MM-DD", cover:ImageRef\|null, images:ImageRef[] }[] }` |
| `content/downloads.json` | `{ id, title, category, description?, file:{ src, ext, sizeBytes:number\|null }, updated?:"YYYY-MM-DD" }[]` |
| `content/media-manifest.json` | `{ "<localSrc>": { width, height, bytes, blurDataURL, formats:{ avif:{w:number,src:string}[], webp:{w:number,src:string}[] } } }` keyed by the `/images/...` paths from A.1 |

## A.4 Rules every extractor must follow

- Decode HTML entities (`&#038;` → `&`, `&#8217;` → `'`, `&nbsp;` → space, `&amp;` → `&`).
- Strip `<style>`, `<script>`, `<quillbot-extension-highlights>`, all `u-*` classes,
  every inline `style=`, every `data-*` attribute, and every `data:` URI.
- Collapse runs of whitespace. Drop empty blocks. Never emit a block that has neither
  text nor an image.
- `alt`: use the source `alt` when non-empty; otherwise derive it from the nearest
  heading or the item's own title. Never leave `alt` undefined on a meaningful image.
- Links: rewrite internal links to our routes (contract §4). `news-details/<id>` →
  `/news/<slug-of-that-id>`. Strip `https://sgsm.com.my/prod` from any remaining
  internal URL. Leave genuinely external URLs alone.
- Output pretty-printed JSON (2-space indent), keys in a stable order.
- Every script is idempotent: running it twice produces byte-identical output.
- Never invent a value. If the source does not have it, omit the field.
