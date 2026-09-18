import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Download, FileText } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Prose } from "@/components/ui/Prose";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { Reveal } from "@/components/motion/Reveal";
import { PageHeader } from "@/components/sections/society/PageHeader";
import { getPage } from "@/lib/content";

const SLUG = "world-handicapping-system";

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

export default function WorldHandicappingSystemPage() {
  const doc = getPage(SLUG);
  if (!doc) notFound();

  return (
    <>
      <PageHeader eyebrow="Privileges" title="World Handicapping System" subtitle={doc.description} />
      <Container size="md" className="py-12 sm:py-16">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Privileges", href: "/golfing" },
            { label: "World Handicapping System" },
          ]}
          className="mb-10"
        />

        <Reveal>
          <Card padding="md" className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <FileText className="h-8 w-8 shrink-0 text-fairway-700" aria-hidden="true" />
              <div>
                <p className="font-display text-lg text-fairway-950">WHS application &amp; user guide</p>
                <p className="text-sm text-ink-500">Download the official forms to register or maintain your handicap.</p>
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                href="/files/sgsm-gogolf-application-form-v4.pdf"
                download
                variant="secondary"
                size="sm"
                icon={<Download className="h-4 w-4" aria-hidden="true" />}
              >
                Application form
              </Button>
              <Button
                href="/files/whs-mobile-apps-user-guide-2022.pdf"
                download
                variant="secondary"
                size="sm"
                icon={<Download className="h-4 w-4" aria-hidden="true" />}
              >
                Mobile app guide
              </Button>
            </div>
          </Card>
        </Reveal>

        <Prose blocks={doc.blocks} />
      </Container>
    </>
  );
}
