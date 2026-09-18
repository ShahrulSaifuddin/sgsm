import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { Reveal } from "@/components/motion/Reveal";
import { PageHeader } from "@/components/sections/society/PageHeader";
import { PrivilegeGrid } from "@/components/sections/privileges/PrivilegeGrid";
import { getPage, getPrivileges } from "@/lib/content";

const SLUG = "golfing";

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

export default function GolfingPage() {
  const doc = getPage(SLUG);
  if (!doc) notFound();
  const privileges = getPrivileges().golfing;

  return (
    <>
      <PageHeader eyebrow="Privileges" title="Golfing" subtitle={doc.description} />
      <Container size="lg" className="py-12 sm:py-16">
        <Breadcrumbs
          items={[{ label: "Home", href: "/" }, { label: "Privileges", href: "/golfing" }, { label: "Golfing" }]}
          className="mb-10"
        />
        <Reveal>
          <p className="max-w-3xl text-lg text-ink-700">
            SGSM members enjoy discounted green fees at these partner clubs and resorts across Malaysia. Select a
            club below to read more about its course and privileges.
          </p>
        </Reveal>
        <div className="mt-10">
          <PrivilegeGrid privileges={privileges} />
        </div>
      </Container>
    </>
  );
}
