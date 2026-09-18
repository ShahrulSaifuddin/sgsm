import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, FileText } from "lucide-react";
import { cn } from "@/lib/cn";
import type { Block, CardItem } from "@/lib/types";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Accordion, type AccordionPanel } from "@/components/ui/Accordion";
import { Stagger } from "@/components/motion/Stagger";

export type ProseProps = {
  blocks: Block[];
  className?: string;
};

/* ------------------------------------------------------------------ */
/* Inline-HTML allowlist sanitizer — "sanitize by construction"        */
/* ------------------------------------------------------------------ */

const ALLOWED_INLINE_TAGS = new Set(["strong", "em", "b", "i", "br", "sup", "sub", "a"]);

// Matches one HTML tag (open, close or self-closing) with simple
// double/single-quoted attributes. Anything that isn't a tag is left as
// plain text and passed through untouched.
const TAG_RE = /<\/?([a-zA-Z][a-zA-Z0-9]*)((?:\s+[a-zA-Z-]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*\/?>/g;

function escapeAttr(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function extractAttr(attrString: string, name: string): string | null {
  const re = new RegExp(`${name}\\s*=\\s*"([^"]*)"|${name}\\s*=\\s*'([^']*)'`, "i");
  const match = attrString.match(re);
  if (!match) return null;
  return match[1] ?? match[2] ?? null;
}

function isSafeHref(href: string): boolean {
  const trimmed = href.trim();
  if (trimmed.startsWith("#") || trimmed.startsWith("/")) return true;
  return /^https?:\/\//i.test(trimmed);
}

/**
 * Rebuilds inline markup from an allowlist rather than trusting the source
 * string: every tag is inspected and either reconstructed clean (only
 * `<strong><em><b><i><a><br><sup><sub>` survive, and `<a>` keeps only
 * `href`/`title`, gaining `target="_blank" rel="noopener noreferrer"` when
 * the link is external) or dropped, keeping its inner text. The *result* of
 * this function — never the raw source — is what reaches
 * `dangerouslySetInnerHTML`.
 */
export function sanitizeInlineHtml(html: string): string {
  if (!html) return "";
  return html.replace(TAG_RE, (match, rawTag: string, attrs: string) => {
    const tag = rawTag.toLowerCase();
    const isClosing = match.startsWith("</");

    if (!ALLOWED_INLINE_TAGS.has(tag)) return "";

    if (tag === "br") return "<br />";

    if (tag === "a") {
      if (isClosing) return "</a>";
      const href = extractAttr(attrs, "href");
      if (!href || !isSafeHref(href)) return "";
      const title = extractAttr(attrs, "title");
      const external = /^https?:\/\//i.test(href.trim());
      let out = `<a href="${escapeAttr(href.trim())}"`;
      if (title) out += ` title="${escapeAttr(title)}"`;
      if (external) out += ` target="_blank" rel="noopener noreferrer"`;
      out += ">";
      return out;
    }

    return isClosing ? `</${tag}>` : `<${tag}>`;
  });
}

type InlineTag = "p" | "span" | "li";

function InlineHtml({ html, as = "span", className }: { html: string; as?: InlineTag; className?: string }) {
  const Tag = as;
  return <Tag className={className} dangerouslySetInnerHTML={{ __html: sanitizeInlineHtml(html) }} />;
}

/* ------------------------------------------------------------------ */
/* Block renderer                                                      */
/* ------------------------------------------------------------------ */

const IMAGE_SIZES = "(min-width: 1024px) 768px, 100vw";
const GRID_IMAGE_SIZES = "(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw";

/** Renders every `Block` variant from `.foreman/schemas.md` §A.2. Server Component — the only client leaf is `Accordion`. */
export function Prose({ blocks, className }: ProseProps) {
  return <div className={cn("prose-sgsm", className)}>{blocks.map((block, i) => renderBlock(block, i))}</div>;
}

function renderBlock(block: Block, i: number): ReactNode {
  switch (block.type) {
    case "paragraph":
      return <InlineHtml key={i} as="p" html={block.html} />;

    case "heading": {
      const Tag = block.level === 2 ? "h2" : block.level === 3 ? "h3" : "h4";
      return <Tag key={i}>{block.text}</Tag>;
    }

    case "list": {
      const ListTag = block.ordered ? "ol" : "ul";
      return (
        <ListTag key={i}>
          {block.items.map((item, idx) => (
            <InlineHtml key={idx} as="li" html={item} />
          ))}
        </ListTag>
      );
    }

    case "image": {
      const { image, caption } = block;
      return (
        <figure key={i}>
          <Image
            src={image.src}
            alt={image.alt}
            width={image.width}
            height={image.height}
            sizes={IMAGE_SIZES}
            className="h-auto w-full rounded-lg"
            {...(image.blurDataURL ? { placeholder: "blur" as const, blurDataURL: image.blurDataURL } : {})}
          />
          {caption ? <figcaption>{caption}</figcaption> : null}
        </figure>
      );
    }

    case "gallery":
      return (
        <Stagger key={i} className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {block.images.map((image, idx) => (
            <div key={idx} className="relative aspect-[4/3] overflow-hidden rounded-lg bg-cream-200">
              <Image
                src={image.src}
                alt={image.alt}
                fill
                sizes={GRID_IMAGE_SIZES}
                className="object-cover"
                {...(image.blurDataURL ? { placeholder: "blur" as const, blurDataURL: image.blurDataURL } : {})}
              />
            </div>
          ))}
        </Stagger>
      );

    case "table":
      return (
        <div key={i} className="overflow-x-auto">
          <table>
            {block.caption ? <caption className="mb-2 text-left text-sm text-ink-500">{block.caption}</caption> : null}
            <thead>
              <tr>
                {block.head.map((cell, idx) => (
                  <th key={idx} scope="col">
                    {cell}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, ridx) => (
                <tr key={ridx}>
                  {row.map((cell, cidx) => (
                    <td key={cidx}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );

    case "quote":
      return (
        <blockquote key={i}>
          <InlineHtml as="p" html={block.html} />
          {block.attribution ? <footer className="mt-2 text-base not-italic text-ink-500">— {block.attribution}</footer> : null}
        </blockquote>
      );

    case "cards":
      return (
        <Stagger key={i} className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {block.items.map((item, idx) => (
            <CardItemView key={idx} item={item} />
          ))}
        </Stagger>
      );

    case "accordion": {
      const panels: AccordionPanel[] = block.items.map((item, idx) => ({
        id: `acc-${i}-${idx}`,
        title: item.title,
        content: <Prose blocks={item.blocks} />,
      }));
      return <Accordion key={i} panels={panels} />;
    }

    case "embed": {
      if (block.kind === "map") {
        return (
          <div key={i} className="overflow-hidden rounded-lg border border-cream-200 shadow-soft">
            <div className="aspect-video w-full">
              <iframe
                src={block.src}
                title={block.title}
                loading="lazy"
                className="h-full w-full"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
          </div>
        );
      }
      return (
        <div key={i} className="rounded-lg border border-cream-200 bg-cream-100 p-6">
          <p className="mb-4 font-display text-lg text-fairway-950">{block.title}</p>
          <Button href={block.src} variant="secondary" icon={<FileText className="h-5 w-5" aria-hidden="true" />}>
            View PDF
          </Button>
        </div>
      );
    }

    default: {
      const _exhaustive: never = block;
      void _exhaustive;
      return null;
    }
  }
}

function CardItemView({ item }: { item: CardItem }) {
  const isExternal = item.href ? /^https?:\/\//i.test(item.href) : false;

  const body = (
    <Card interactive={!!item.href} padding="md" className="flex h-full flex-col gap-4">
      {item.image ? (
        <div className="relative -mx-6 -mt-6 aspect-[4/3] overflow-hidden rounded-t-lg bg-cream-200">
          <Image
            src={item.image.src}
            alt={item.image.alt}
            fill
            sizes={GRID_IMAGE_SIZES}
            className="object-cover"
            {...(item.image.blurDataURL ? { placeholder: "blur" as const, blurDataURL: item.image.blurDataURL } : {})}
          />
        </div>
      ) : null}
      <div className="flex flex-1 flex-col gap-2">
        <h3 className="font-display text-xl text-fairway-950">{item.title}</h3>
        {item.subtitle ? <p className="text-sm font-medium uppercase tracking-wide text-fairway-700">{item.subtitle}</p> : null}
        {item.body ? <p className="text-base text-ink-700">{item.body}</p> : null}
      </div>
      {item.href ? (
        <span className="mt-auto inline-flex items-center gap-1.5 text-base font-medium text-fairway-700">
          Learn more <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </span>
      ) : null}
    </Card>
  );

  if (!item.href) return body;

  if (isExternal) {
    return (
      <a href={item.href} target="_blank" rel="noopener noreferrer" className="block h-full">
        {body}
      </a>
    );
  }

  return (
    <Link href={item.href} className="block h-full">
      {body}
    </Link>
  );
}
