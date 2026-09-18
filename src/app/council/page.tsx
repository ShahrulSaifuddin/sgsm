import type { Metadata } from "next";
import { getCouncil } from "@/lib/content";
import { Container } from "@/components/ui/Container";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { PageHeader } from "@/components/sections/society/PageHeader";
import { CouncilGroupSection } from "@/components/sections/society/CouncilSection";

const SLUG = "council";

export const metadata: Metadata = {
  title: "Council Members",
  description: "The Council Members and Officers of the Senior Golfers' Society of Malaysia, elected to lead the Society's affairs.",
  alternates: { canonical: `/${SLUG}` },
  openGraph: {
    title: "Council Members",
    description: "The Council Members and Officers of the Senior Golfers' Society of Malaysia, elected to lead the Society's affairs.",
    url: `/${SLUG}`,
    type: "website",
  },
};

export default function CouncilPage() {
  const doc = getCouncil();

  return (
    <article>
      <PageHeader eyebrow="Introduction" title={doc.title} subtitle={doc.subtitle} />
      <Container size="lg" className="py-12 sm:py-16">
        <Breadcrumbs
          items={[{ label: "Home", href: "/" }, { label: "Introduction", href: "/about-us" }, { label: "Council Members" }]}
          className="mb-6"
        />
        <div className="divide-y divide-cream-200">
          {doc.groups.map((group, index) => (
            <CouncilGroupSection key={group.title} group={group} index={index} />
          ))}
        </div>
      </Container>
    </article>
  );
}
