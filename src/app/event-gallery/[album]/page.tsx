import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ImageOff } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { Reveal } from "@/components/motion/Reveal";
import { getAlbumBySlug, listAlbums, MAX_PER_PAGE } from "@/lib/db/queries";
import { resolveImage } from "@/lib/content";
import { formatDate } from "@/lib/format";
import { AlbumGalleryGrid, type GalleryImage } from "@/components/sections/gallery/AlbumGalleryGrid";

export async function generateStaticParams() {
  const { rows } = await listAlbums({ per: MAX_PER_PAGE });
  return rows.map((album) => ({ album: album.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ album: string }>;
}): Promise<Metadata> {
  const { album: slug } = await params;
  const album = await getAlbumBySlug(slug);
  if (!album) return {};

  const description = `${album.imagesTotal} photo${album.imagesTotal === 1 ? "" : "s"} from ${album.title}.`;
  const canonical = `/event-gallery/${album.slug}`;

  return {
    title: album.title,
    description,
    alternates: { canonical },
    openGraph: {
      title: album.title,
      description,
      url: canonical,
      type: "website",
      ...(album.cover
        ? { images: [{ url: album.cover.src, width: album.cover.width, height: album.cover.height, alt: album.cover.alt }] }
        : {}),
    },
  };
}

export default async function AlbumDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ album: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { album: slug } = await params;
  const raw = await searchParams;
  const page = Number(raw.page) || 1;

  const album = await getAlbumBySlug(slug, { page });
  if (!album) notFound();

  const images: GalleryImage[] = album.images.map((image) => {
    const resolved = resolveImage(image.src);
    return {
      id: image.id,
      src: image.src,
      alt: image.alt && image.alt.length > 0 ? image.alt : album.title,
      width: resolved?.width ?? image.width ?? 1200,
      height: resolved?.height ?? image.height ?? 800,
      blurDataURL: resolved?.blurDataURL,
      caption: image.caption,
    };
  });

  return (
    <>
      <Container size="lg" className="pt-10 sm:pt-14">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Event Gallery", href: "/event-gallery" },
            { label: album.title },
          ]}
        />
      </Container>

      <Container size="lg" className="pb-20 pt-6">
        <Reveal>
          <h1 className="text-3xl leading-tight sm:text-4xl">{album.title}</h1>
          <p className="mt-3 text-ink-500">
            {album.date ? `${formatDate(album.date)} · ` : ""}
            {album.imagesTotal} photo{album.imagesTotal === 1 ? "" : "s"}
          </p>
        </Reveal>

        {images.length === 0 ? (
          <EmptyState
            className="mt-10"
            icon={<ImageOff className="h-10 w-10" aria-hidden="true" />}
            title="No photos on this page"
            description="Go back to the first page of this album."
            action={
              <Button href={`/event-gallery/${album.slug}`} variant="secondary">
                View first page
              </Button>
            }
          />
        ) : (
          <div className="mt-10">
            <AlbumGalleryGrid images={images} />
          </div>
        )}

        <Pagination
          className="mt-12"
          currentPage={album.page}
          totalPages={album.pages}
          hrefForPage={(p) => (p === 1 ? `/event-gallery/${album.slug}` : `/event-gallery/${album.slug}?page=${p}`)}
        />
      </Container>
    </>
  );
}
