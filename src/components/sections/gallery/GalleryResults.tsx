import { Images } from "lucide-react";
import { Pagination } from "@/components/ui/Pagination";
import { EmptyState } from "@/components/ui/EmptyState";
import { Stagger } from "@/components/motion/Stagger";
import { listAlbums } from "@/lib/db/queries";
import { AlbumCard } from "@/components/sections/gallery/AlbumCard";

export type GalleryRawSearchParams = { page?: string };

/**
 * Async data boundary for `/event-gallery`. Rendered inside a `<Suspense>`
 * from the page shell so the breadcrumbs/heading/intro can stream before the
 * SQLite query resolves; this is where `searchParams` is finally awaited.
 */
export async function GalleryResults({ searchParams }: { searchParams: Promise<GalleryRawSearchParams> }) {
  const raw = await searchParams;
  const page = Number(raw.page) || 1;
  const result = await listAlbums({ page });

  return (
    <>
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
    </>
  );
}
