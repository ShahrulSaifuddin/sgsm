import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { ComingSoon } from "@/components/sections/privileges/ComingSoon";
import { getPage } from "@/lib/content";

const SLUG = "others";

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

export default function OthersPage() {
  const doc = getPage(SLUG);
  if (!doc) notFound();

  return (
    <Container size="lg" className="py-12 sm:py-16">
      <Breadcrumbs
        items={[{ label: "Home", href: "/" }, { label: "Privileges", href: "/golfing" }, { label: "Others" }]}
        className="mb-10"
      />
      <ComingSoon title={doc.title} description="This page is being prepared with additional member privileges." />
    </Container>
  );
}
