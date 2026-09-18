import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPage } from "@/lib/content";
import { Container } from "@/components/ui/Container";
import { Prose } from "@/components/ui/Prose";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { Reveal } from "@/components/motion/Reveal";
import { PageHeader } from "@/components/sections/society/PageHeader";

const SLUG = "collaborative-partnership";

export function generateMetadata(): Metadata {
  const doc = getPage(SLUG);
  if (!doc) return {};
  return {
    title: doc.title,
    description: doc.description,
    alternates: { canonical: `/${SLUG}` },
    openGraph: {
      title: doc.title,
      description: doc.description,
      url: `/${SLUG}`,
      type: "website",
    },
  };
}

export default function CollaborativePartnershipPage() {
  const doc = getPage(SLUG);
  if (!doc) notFound();

  return (
    <article>
      <PageHeader eyebrow="Introduction" title={doc.title} subtitle={doc.description} />
      <Container size="lg" className="py-12 sm:py-16">
        <Breadcrumbs
          items={[{ label: "Home", href: "/" }, { label: "Introduction", href: "/about-us" }, { label: doc.title }]}
          className="mb-10"
        />
        <Reveal>
          <Prose blocks={doc.blocks} className="max-w-none" />
        </Reveal>
      </Container>
    </article>
  );
}
