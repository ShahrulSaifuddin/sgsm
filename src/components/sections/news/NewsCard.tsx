import Image from "next/image";
import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { resolveImage } from "@/lib/content";
import { formatDateShort } from "@/lib/format";
import { truncate } from "@/lib/format";
import type { NewsListItem } from "@/lib/db/queries";

export type NewsCardProps = {
  news: NewsListItem;
  /** Marks this card's image as the page's LCP element — at most one per page. */
  priority?: boolean;
};

const GRID_IMAGE_SIZES = "(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw";

/** News list card. Mirrors EventCard's shape for visual consistency across list pages. */
export function NewsCard({ news, priority = false }: NewsCardProps) {
  const resolved = news.image ? resolveImage(news.image.src) : null;
  const blurDataURL = resolved?.blurDataURL ?? news.image?.blurDataURL;

  return (
    <Link href={`/news/${news.slug}`} className="group block h-full">
      <Card interactive padding="sm" className="flex h-full flex-col gap-4">
        {news.image ? (
          <div className="relative aspect-video overflow-hidden rounded-md bg-cream-200">
            <Image
              src={news.image.src}
              alt={news.image.alt}
              fill
              sizes={GRID_IMAGE_SIZES}
              className="object-cover transition-transform duration-200 motion-safe:group-hover:scale-105"
              {...(priority ? { priority: true } : { loading: "lazy" as const })}
              {...(blurDataURL ? { placeholder: "blur" as const, blurDataURL } : {})}
            />
          </div>
        ) : null}

        <div className="flex flex-1 flex-col gap-2 px-1 pb-1">
          <p className="flex items-center gap-1.5 text-sm font-medium text-fairway-700">
            <CalendarDays className="h-4 w-4 shrink-0" aria-hidden="true" />
            {formatDateShort(news.date)}
          </p>
          <h3 className="font-display text-xl leading-snug text-fairway-950">{news.title}</h3>
          {news.excerpt ? <p className="text-base text-ink-700">{truncate(news.excerpt, 140)}</p> : null}
          <div className="mt-auto pt-2">
            <Badge variant="fairway">{news.category}</Badge>
          </div>
        </div>
      </Card>
    </Link>
  );
}
