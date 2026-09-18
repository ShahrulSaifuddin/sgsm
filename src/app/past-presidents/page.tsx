import type { Metadata } from "next";
import { getPastPresidents } from "@/lib/content";
import { Container } from "@/components/ui/Container";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { PageHeader } from "@/components/sections/society/PageHeader";
import { PastPresidentsTable } from "@/components/sections/society/PastPresidentsTable";

const SLUG = "past-presidents";

export const metadata: Metadata = {
  title: "Past Presidents",
  description: "The full roll of Presidents of the Senior Golfers' Society of Malaysia, from its founding in 1931 to the present day.",
  alternates: { canonical: `/${SLUG}` },
  openGraph: {
    title: "Past Presidents",
    description: "The full roll of Presidents of the Senior Golfers' Society of Malaysia, from its founding in 1931 to the present day.",
    url: `/${SLUG}`,
    type: "website",
  },
};

export default function PastPresidentsPage() {
  const doc = getPastPresidents();

  return (
    <article>
      <PageHeader eyebrow="Introduction" title={doc.title} subtitle={`${doc.rows.length} presidents, 1931 to present`} />
      <Container size="md" className="py-12 sm:py-16">
        <Breadcrumbs
          items={[{ label: "Home", href: "/" }, { label: "Introduction", href: "/about-us" }, { label: doc.title }]}
          className="mb-8"
        />
        <PastPresidentsTable rows={doc.rows} caption={doc.title} />
      </Container>
    </article>
  );
}
