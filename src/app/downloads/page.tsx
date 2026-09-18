import type { Metadata } from "next";
import { Suspense } from "react";
import { Container } from "@/components/ui/Container";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { Reveal } from "@/components/motion/Reveal";
import { DownloadsResults, type DownloadsRawSearchParams } from "@/components/sections/downloads/DownloadsResults";
import { DownloadsResultsSkeleton } from "@/components/sections/downloads/DownloadsResultsSkeleton";

export const metadata: Metadata = {
  title: "Downloads",
  description: "Forms, guides and reports available for download from the Senior Golfers' Society of Malaysia.",
  alternates: { canonical: "/downloads" },
  openGraph: {
    title: "Downloads | SGSM",
    description: "Forms, guides and reports available for download from SGSM.",
    url: "/downloads",
    type: "website",
  },
};

/**
 * Not `async` — `searchParams` is passed straight through to `DownloadsResults`
 * without being awaited here, so this shell (breadcrumbs, heading, intro) can
 * stream immediately while the SQLite query resolves inside the Suspense boundary.
 */
export default function DownloadsPage({ searchParams }: { searchParams: Promise<DownloadsRawSearchParams> }) {
  return (
    <>
      <Container size="lg" className="pt-10 sm:pt-14">
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Downloads" }]} />
      </Container>

      <Container size="md" className="pb-20 pt-6">
        <Reveal>
          <p className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.14em] text-fairway-700">
            <span aria-hidden="true" className="h-[2px] w-8 bg-gold-500" />
            Forms &amp; reports
          </p>
          <h1 className="text-3xl sm:text-4xl">Downloads</h1>
          <p className="mt-4 max-w-2xl text-lg text-ink-700">
            Application forms, member guides and Society reports, ready to download.
          </p>
        </Reveal>

        <Suspense fallback={<DownloadsResultsSkeleton />}>
          <DownloadsResults searchParams={searchParams} />
        </Suspense>
      </Container>
    </>
  );
}
