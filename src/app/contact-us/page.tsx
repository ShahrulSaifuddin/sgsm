import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { UserPlus } from "lucide-react";
import { getPage, getSiteConfig } from "@/lib/content";
import type { Block } from "@/lib/types";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { Reveal } from "@/components/motion/Reveal";
import { PageHeader } from "@/components/sections/society/PageHeader";
import { firstBlockImage } from "@/components/sections/society/og-image";
import { ContactCards, type SecondaryPhone } from "@/components/sections/contact/ContactCards";
import { MapEmbed } from "@/components/sections/contact/MapEmbed";

const SLUG = "contact-us";

export function generateMetadata(): Metadata {
  const doc = getPage(SLUG);
  if (!doc) return {};
  const image = firstBlockImage(doc.blocks);
  return {
    title: doc.title,
    description: doc.description,
    alternates: { canonical: `/${SLUG}` },
    openGraph: {
      title: `${doc.title} | SGSM`,
      description: doc.description,
      url: `/${SLUG}`,
      type: "article",
      ...(image ? { images: [{ url: image.src, width: image.width, height: image.height, alt: image.alt }] } : {}),
    },
  };
}

/** Finds the `embed`/`map` block that carries the office's Google Maps URL. */
function findMapEmbed(blocks: Block[]): Extract<Block, { type: "embed" }> | null {
  const embed = blocks.find((block) => block.type === "embed" && block.kind === "map");
  return (embed as Extract<Block, { type: "embed" }> | undefined) ?? null;
}

/**
 * `content/pages/contact-us.json` carries one more phone number (a mobile /
 * WhatsApp line) inside the "Get in touch" card's free-text body than
 * `site.json` exposes structurally. Pulling it out here — rather than
 * hardcoding it — keeps every digit traceable back to the extracted content.
 */
function findSecondaryPhone(blocks: Block[], primaryPhone: string): SecondaryPhone | null {
  const cardsBlock = blocks.find((block) => block.type === "cards");
  if (!cardsBlock || cardsBlock.type !== "cards") return null;

  const item = cardsBlock.items.find((candidate) => candidate.title.toLowerCase().includes("touch"));
  if (!item?.body) return null;

  const normalize = (value: string) => value.replace(/\s+/g, "");
  const primaryNormalized = normalize(primaryPhone);
  const matches = item.body.match(/\+\d[\d\s]{6,}\d/g) ?? [];
  const extra = matches.map((match) => match.trim()).find((match) => normalize(match) !== primaryNormalized);

  if (!extra) return null;
  return { display: extra, href: `tel:${normalize(extra)}` };
}

export default function ContactUsPage() {
  const doc = getPage(SLUG);
  if (!doc) notFound();
  const site = getSiteConfig();

  const mapEmbed = findMapEmbed(doc.blocks);
  const secondaryPhone = findSecondaryPhone(doc.blocks, site.phone);

  return (
    <article>
      <PageHeader eyebrow="Get in touch" title={doc.title} subtitle={doc.description} />

      <Container size="lg" className="py-12 sm:py-16">
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Contact Us" }]} className="mb-10" />

        <Reveal>
          <ContactCards site={site} secondaryPhone={secondaryPhone} />
        </Reveal>

        {mapEmbed ? (
          <Reveal delay={0.05} className="mt-10">
            <h2 className="mb-4 font-display text-2xl text-fairway-950">Find us</h2>
            <MapEmbed src={mapEmbed.src} title={mapEmbed.title} />
          </Reveal>
        ) : null}

        <Reveal delay={0.1} className="mt-12">
          <div className="flex flex-col gap-4 rounded-lg border border-fairway-900/20 bg-fairway-100 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
            <div>
              <h2 className="font-display text-xl text-fairway-950">Interested in becoming a member?</h2>
              <p className="mt-1 max-w-xl text-base text-ink-700">
                Membership enquiries are handled through our online application, or reach us directly using the
                details above — our council will follow up with the next steps.
              </p>
            </div>
            <Button
              href="/join"
              variant="primary"
              icon={<UserPlus className="h-5 w-5" aria-hidden="true" />}
              className="shrink-0 self-start sm:self-center"
            >
              Join SGSM
            </Button>
          </div>
        </Reveal>
      </Container>
    </article>
  );
}
