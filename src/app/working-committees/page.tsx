import type { Metadata } from "next";
import { getCommittees } from "@/lib/content";
import { Container } from "@/components/ui/Container";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { Reveal } from "@/components/motion/Reveal";
import { PageHeader } from "@/components/sections/society/PageHeader";
import { CommitteesAccordion } from "@/components/sections/society/CommitteesAccordion";

const SLUG = "working-committees";

export const metadata: Metadata = {
  title: "Working Committees",
  description: "The working committees of the Senior Golfers' Society of Malaysia and the members who chair and serve on each one.",
  alternates: { canonical: `/${SLUG}` },
  openGraph: {
    title: "Working Committees",
    description: "The working committees of the Senior Golfers' Society of Malaysia and the members who chair and serve on each one.",
    url: `/${SLUG}`,
    type: "website",
  },
};

export default function WorkingCommitteesPage() {
  const doc = getCommittees();

  return (
    <article>
      <PageHeader eyebrow="Introduction" title={doc.title} subtitle={`${doc.committees.length} committees`} />
      <Container size="md" className="py-12 sm:py-16">
        <Breadcrumbs
          items={[{ label: "Home", href: "/" }, { label: "Introduction", href: "/about-us" }, { label: doc.title }]}
          className="mb-8"
        />
        <Reveal>
          <CommitteesAccordion committees={doc.committees} />
        </Reveal>
      </Container>
    </article>
  );
}
