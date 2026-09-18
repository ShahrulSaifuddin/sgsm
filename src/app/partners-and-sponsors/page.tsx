import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { Reveal } from "@/components/motion/Reveal";
import { PageHeader } from "@/components/sections/society/PageHeader";
import { PartnersGrid } from "@/components/sections/privileges/PartnersGrid";
import { getPage, getPartners } from "@/lib/content";

const SLUG = "partners-and-sponsors";

export function generateMetadata(): Metadata {
  const doc = getPage(SLUG);
  if (!doc) return {};
  return {
    title: doc.title,
    description: doc.description,
    alternates: { canonical: `/${SLUG}` },
    openGraph: {
      title: `${doc.title} | SGSM`,
      description: doc.description,
      url: `/${SLUG}`,
      type: "website",
    },
  };
}

export default function PartnersAndSponsorsPage() {
  const doc = getPage(SLUG);
  if (!doc) notFound();
  const partnersDoc = getPartners();

  return (
    <>
      <PageHeader eyebrow="Privileges" title="Partners and Sponsors" subtitle={partnersDoc.intro} />
      <Container size="lg" className="py-12 sm:py-16">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Privileges", href: "/golfing" },
            { label: "Partners and Sponsors" },
          ]}
          className="mb-10"
        />
        {partnersDoc.partners.length > 0 ? (
          <Reveal>
            <PartnersGrid partners={partnersDoc.partners} />
          </Reveal>
        ) : null}
      </Container>
    </>
  );
}
