import type { Metadata } from "next";
import { getPatrons } from "@/lib/content";
import { Container } from "@/components/ui/Container";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { PageHeader } from "@/components/sections/society/PageHeader";
import { PatronGroupSection } from "@/components/sections/society/PatronsSection";

const SLUG = "patrons-and-honorary-members";

export const metadata: Metadata = {
  title: "Patrons and Honorary Members",
  description:
    "The Royal Patron, Patrons and Honorary Members of the Senior Golfers' Society of Malaysia — distinguished figures who lend their name and support to the Society.",
  alternates: { canonical: `/${SLUG}` },
  openGraph: {
    title: "Patrons and Honorary Members",
    description: "The Royal Patron, Patrons and Honorary Members of the Senior Golfers' Society of Malaysia.",
    url: `/${SLUG}`,
    type: "website",
  },
};

export default function PatronsAndHonoraryMembersPage() {
  const doc = getPatrons();

  return (
    <article>
      <PageHeader eyebrow="Introduction" title={doc.title} />
      <Container size="lg" className="py-12 sm:py-16">
        <Breadcrumbs
          items={[{ label: "Home", href: "/" }, { label: "Introduction", href: "/about-us" }, { label: doc.title }]}
          className="mb-6"
        />
        <div className="divide-y divide-cream-200">
          {doc.groups.map((group, index) => (
            <PatronGroupSection key={group.title} group={group} index={index} />
          ))}
        </div>
      </Container>
    </article>
  );
}
