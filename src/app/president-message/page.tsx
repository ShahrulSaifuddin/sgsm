import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPage } from "@/lib/content";
import { Container } from "@/components/ui/Container";
import { Prose } from "@/components/ui/Prose";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { Reveal } from "@/components/motion/Reveal";
import { PageHeader } from "@/components/sections/society/PageHeader";

const SLUG = "president-message";

export function generateMetadata(): Metadata {
  const doc = getPage(SLUG);
  if (!doc) return {};
  const image = doc.hero?.image;
  return {
    title: doc.title,
    description: doc.description,
    alternates: { canonical: `/${SLUG}` },
    openGraph: {
      title: doc.title,
      description: doc.description,
      url: `/${SLUG}`,
      type: "article",
      ...(image ? { images: [{ url: image.src, width: image.width, height: image.height, alt: image.alt }] } : {}),
    },
  };
}

export default function PresidentMessagePage() {
  const doc = getPage(SLUG);
  if (!doc) notFound();

  return (
    <article>
      <PageHeader eyebrow="Introduction" title={doc.hero?.title ?? doc.title} image={doc.hero?.image} />
      <Container size="sm" className="py-12 sm:py-16">
        <Breadcrumbs
          items={[{ label: "Home", href: "/" }, { label: "Introduction", href: "/about-us" }, { label: doc.title }]}
          className="mb-10"
        />
        <Reveal>
          <Prose blocks={doc.blocks} />
        </Reveal>
      </Container>
    </article>
  );
}
