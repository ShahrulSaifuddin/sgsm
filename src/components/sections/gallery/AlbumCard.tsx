import Image from "next/image";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { resolveImage } from "@/lib/content";
import { formatDate } from "@/lib/format";
import type { AlbumListItem } from "@/lib/db/queries";

export type AlbumCardProps = {
  album: AlbumListItem;
  /** Marks this card's cover image as the page's LCP element — at most one per page. */
  priority?: boolean;
};

/** Gallery album card: cover crop + title + date + photo count. */
export function AlbumCard({ album, priority = false }: AlbumCardProps) {
  const resolved = album.cover ? resolveImage(album.cover.src) : null;
  const blurDataURL = resolved?.blurDataURL ?? album.cover?.blurDataURL;

  return (
    <Link href={`/event-gallery/${album.slug}`} className="group block h-full">
      <Card interactive padding="sm" className="flex h-full flex-col gap-3">
        <div className="relative aspect-[4/3] overflow-hidden rounded-md bg-cream-200">
          {album.cover ? (
            <Image
              src={album.cover.src}
              alt={album.cover.alt}
              fill
              sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
              className="object-cover transition-transform duration-200 motion-safe:group-hover:scale-105"
              {...(priority ? { priority: true } : { loading: "lazy" as const })}
              {...(blurDataURL ? { placeholder: "blur" as const, blurDataURL } : {})}
            />
          ) : null}
          <span className="absolute bottom-2 right-2 rounded-full bg-ink-900/70 px-2.5 py-1 text-xs font-medium text-cream-50">
            {album.imageCount} photo{album.imageCount === 1 ? "" : "s"}
          </span>
        </div>
        <div className="flex flex-1 flex-col gap-1 px-1 pb-1">
          <h3 className="font-display text-lg leading-snug text-fairway-950">{album.title}</h3>
          {album.date ? <p className="text-sm text-ink-500">{formatDate(album.date)}</p> : null}
        </div>
      </Card>
    </Link>
  );
}
