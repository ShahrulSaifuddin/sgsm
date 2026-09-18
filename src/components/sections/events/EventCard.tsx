import Image from "next/image";
import Link from "next/link";
import { MapPin, Wallet } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { resolveImage } from "@/lib/content";
import { formatEventDateRange } from "@/lib/format";
import type { EventListItem } from "@/lib/db/queries";

export type EventCardProps = {
  event: EventListItem;
  /** Marks this card's image as the page's LCP element — at most one per page. */
  priority?: boolean;
};

function eventStatus(startDate: string): "upcoming" | "past" {
  return new Date(startDate).getTime() >= Date.now() ? "upcoming" : "past";
}

/** Event list card. Titles are allowed to wrap onto multiple lines (never truncated) per contract. */
export function EventCard({ event, priority = false }: EventCardProps) {
  const resolved = event.image ? resolveImage(event.image.src) : null;
  const blurDataURL = resolved?.blurDataURL ?? event.image?.blurDataURL;
  const status = eventStatus(event.startDate);
  const venueLine = event.venue ? [event.venue.name, event.venue.city].filter(Boolean).join(", ") : null;

  return (
    <Link href={`/events/${event.slug}`} className="group block h-full">
      <Card interactive padding="sm" className="flex h-full flex-col gap-4">
        {event.image ? (
          <div className="relative aspect-video overflow-hidden rounded-md bg-cream-200">
            <Image
              src={event.image.src}
              alt={event.image.alt}
              fill
              sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
              className="object-cover transition-transform duration-200 motion-safe:group-hover:scale-105"
              {...(priority ? { priority: true } : { loading: "lazy" as const })}
              {...(blurDataURL ? { placeholder: "blur" as const, blurDataURL } : {})}
            />
            <Badge variant={status === "upcoming" ? "gold" : "cream"} className="absolute left-3 top-3">
              {status === "upcoming" ? "Upcoming" : "Past"}
            </Badge>
          </div>
        ) : null}

        <div className="flex flex-1 flex-col gap-2 px-1 pb-1">
          <p className="text-sm font-medium text-fairway-700">
            {formatEventDateRange(event.startDate, event.endDate, event.allDay)}
          </p>
          <h3 className="font-display text-xl leading-snug text-fairway-950">{event.title}</h3>
          {venueLine ? (
            <p className="flex items-start gap-1.5 text-sm text-ink-500">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{venueLine}</span>
            </p>
          ) : null}
          {event.cost ? (
            <p className="flex items-center gap-1.5 text-sm text-ink-500">
              <Wallet className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{event.cost}</span>
            </p>
          ) : null}
          {event.categories.length > 0 ? (
            <div className="mt-auto flex flex-wrap gap-2 pt-2">
              {event.categories.map((c) => (
                <Badge key={c} variant="fairway">
                  {c}
                </Badge>
              ))}
            </div>
          ) : null}
        </div>
      </Card>
    </Link>
  );
}
