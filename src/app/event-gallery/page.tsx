import type { Metadata } from "next";
import { Suspense } from "react";
import { Container } from "@/components/ui/Container";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { Reveal } from "@/components/motion/Reveal";
import { GalleryResults, type GalleryRawSearchParams } from "@/components/sections/gallery/GalleryResults";
import { GalleryResultsSkeleton } from "@/components/sections/gallery/GalleryResultsSkeleton";

export const metadata: Metadata = {
  title: "Event Gallery",
  description: "Photo albums from SGSM tournaments, outings and society gatherings.",
  alternates: { canonical: "/event-gallery" },
  openGraph: {
    title: "Event Gallery | SGSM",
    description: "Photo albums from SGSM tournaments, outings and society gatherings.",
    url: "/event-gallery",
    type: "website",
  },
};

/**
 * Not `async` — `searchParams` is passed straight through to `GalleryResults`
 * without being awaited here, so this shell (breadcrumbs, heading, intro) can
 * stream immediately while the SQLite query resolves inside the Suspense boundary.
 */
export default function EventGalleryPage({
  searchParams,
}: {
  searchParams: Promise<GalleryRawSearchParams>;
}) {
  return (
    <>
      <Container size="lg" className="pt-10 sm:pt-14">
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Event Gallery" }]} />
      </Container>

      <Container size="lg" className="pb-20 pt-6">
        <Reveal>
          <p className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.14em] text-fairway-700">
            <span aria-hidden="true" className="h-[2px] w-8 bg-gold-500" />
            Memories
          </p>
          <h1 className="text-3xl sm:text-4xl">Event Gallery</h1>
          <p className="mt-4 max-w-2xl text-lg text-ink-700">
            Photo albums from tournaments, outings and society gatherings.
          </p>
        </Reveal>

        <Suspense fallback={<GalleryResultsSkeleton />}>
          <GalleryResults searchParams={searchParams} />
        </Suspense>
      </Container>
    </>
  );
}
