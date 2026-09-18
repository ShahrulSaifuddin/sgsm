import type { Metadata } from "next";
import { Images } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { Pagination } from "@/components/ui/Pagination";
import { EmptyState } from "@/components/ui/EmptyState";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { Reveal } from "@/components/motion/Reveal";
import { Stagger } from "@/components/motion/Stagger";
import { listAlbums } from "@/lib/db/queries";
import { AlbumCard } from "@/components/sections/gallery/AlbumCard";

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

export default async function EventGalleryPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const raw = await searchParams;
  const page = Number(raw.page) || 1;
  const result = await listAlbums({ page });

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

        {result.rows.length === 0 ? (
          <EmptyState
            className="mt-10"
            icon={<Images className="h-10 w-10" aria-hidden="true" />}
            title="No albums yet"
            description="Check back after the next event."
          />
        ) : (
          <>
            <Stagger className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {result.rows.map((album, index) => (
                <AlbumCard key={album.id} album={album} priority={page === 1 && index === 0} />
              ))}
            </Stagger>

            <Pagination
              className="mt-12"
              currentPage={result.page}
              totalPages={result.pages}
              hrefForPage={(p) => (p === 1 ? "/event-gallery" : `/event-gallery?page=${p}`)}
            />
          </>
        )}
      </Container>
    </>
  );
}
