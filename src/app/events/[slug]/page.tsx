import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { CalendarDays, Globe, MapPin, Wallet } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Prose } from "@/components/ui/Prose";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { Reveal } from "@/components/motion/Reveal";
import { getEventBySlug, listEvents, MAX_PER_PAGE, type EventDetail } from "@/lib/db/queries";
import { getSiteConfig, resolveImage } from "@/lib/content";
import { formatEventDateRange } from "@/lib/format";

const SITE_URL = "https://www.sgsm.com.my";

export async function generateStaticParams() {
  const { rows } = await listEvents({ per: MAX_PER_PAGE, when: "all" });
  return rows.map((event) => ({ slug: event.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const event = await getEventBySlug(slug);
  if (!event) return {};

  const description = event.excerpt || `${event.title} — hosted by the Senior Golfers' Society of Malaysia.`;
  const canonical = `/events/${event.slug}`;

  return {
    title: event.title,
    description,
    alternates: { canonical },
    openGraph: {
      title: event.title,
      description,
      url: canonical,
      type: "article",
      ...(event.image
        ? { images: [{ url: event.image.src, width: event.image.width, height: event.image.height, alt: event.image.alt }] }
        : {}),
    },
  };
}

function eventJsonLd(event: EventDetail, siteName: string) {
  return {
    "@context": "https://schema.org",
    "@type": "Event",
    name: event.title,
    startDate: event.startDate,
    endDate: event.endDate,
    eventStatus: "https://schema.org/EventScheduled",
    ...(event.venue
      ? {
          location: {
            "@type": "Place",
            name: event.venue.name,
            address: {
              "@type": "PostalAddress",
              ...(event.venue.city ? { addressLocality: event.venue.city } : {}),
              ...(event.venue.province ? { addressRegion: event.venue.province } : {}),
              ...(event.venue.country ? { addressCountry: event.venue.country } : {}),
            },
          },
        }
      : {}),
    ...(event.image ? { image: [new URL(event.image.src, SITE_URL).toString()] } : {}),
    organizer: { "@type": "Organization", name: siteName, url: SITE_URL },
  };
}

export default async function EventDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const event = await getEventBySlug(slug);
  if (!event) notFound();

  const site = getSiteConfig();
  const resolved = event.image ? resolveImage(event.image.src) : null;
  const heroWidth = resolved?.width ?? event.image?.width ?? 1200;
  const heroHeight = resolved?.height ?? event.image?.height ?? 675;
  const blurDataURL = resolved?.blurDataURL ?? event.image?.blurDataURL;
  const mapsHref = event.venue?.mapQuery
    ? `https://www.google.com/maps/search/?api=1&query=${event.venue.mapQuery}`
    : null;
  const venueLocation = event.venue
    ? [event.venue.city, event.venue.province, event.venue.country].filter(Boolean).join(", ")
    : null;
  const jsonLd = eventJsonLd(event, site.name);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <Container size="lg" className="pt-10 sm:pt-14">
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Events", href: "/events" }, { label: event.title }]} />
      </Container>

      <Container size="md" className="pb-20 pt-6">
        <Reveal>
          <p className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.14em] text-fairway-700">
            <span aria-hidden="true" className="h-[2px] w-8 bg-gold-500" />
            {formatEventDateRange(event.startDate, event.endDate, event.allDay)}
          </p>
          <h1 className="text-3xl leading-tight sm:text-4xl lg:text-5xl">{event.title}</h1>

          {event.categories.length > 0 ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {event.categories.map((c) => (
                <Badge key={c} variant="fairway">
                  {c}
                </Badge>
              ))}
            </div>
          ) : null}
        </Reveal>

        {event.image ? (
          <Reveal className="mt-8" delay={0.05}>
            <div
              className="relative overflow-hidden rounded-lg bg-cream-200"
              style={{ aspectRatio: `${heroWidth} / ${heroHeight}` }}
            >
              <Image
                src={event.image.src}
                alt={event.image.alt}
                fill
                sizes="(min-width: 1024px) 768px, 100vw"
                className="object-cover"
                priority
                {...(blurDataURL ? { placeholder: "blur" as const, blurDataURL } : {})}
              />
            </div>
          </Reveal>
        ) : null}

        <Reveal className="mt-10 grid gap-6 sm:grid-cols-2" delay={0.1}>
          <div className="rounded-lg border border-cream-200 bg-cream-50 p-5">
            <h2 className="flex items-center gap-2 text-lg text-fairway-950">
              <CalendarDays className="h-5 w-5 text-fairway-700" aria-hidden="true" />
              When
            </h2>
            <p className="mt-2 text-ink-700">{formatEventDateRange(event.startDate, event.endDate, event.allDay)}</p>
            {event.cost ? (
              <p className="mt-3 flex items-center gap-2 text-ink-700">
                <Wallet className="h-4 w-4 shrink-0 text-fairway-700" aria-hidden="true" />
                <span>{event.cost}</span>
              </p>
            ) : null}
            {event.website ? (
              <p className="mt-3 flex items-center gap-2 text-ink-700">
                <Globe className="h-4 w-4 shrink-0 text-fairway-700" aria-hidden="true" />
                <a
                  href={event.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-fairway-700"
                >
                  Event website
                </a>
              </p>
            ) : null}
          </div>

          {event.venue ? (
            <div className="rounded-lg border border-cream-200 bg-cream-50 p-5">
              <h2 className="flex items-center gap-2 text-lg text-fairway-950">
                <MapPin className="h-5 w-5 text-fairway-700" aria-hidden="true" />
                Venue
              </h2>
              <p className="mt-2 text-ink-700">{event.venue.name}</p>
              {venueLocation ? <p className="text-ink-500">{venueLocation}</p> : null}
              {mapsHref ? (
                <div className="mt-4">
                  <Button href={mapsHref} variant="secondary" size="sm">
                    View on Google Maps
                  </Button>
                </div>
              ) : null}
            </div>
          ) : null}
        </Reveal>

        {event.blocks.length > 0 ? (
          <div className="mt-12">
            <Prose blocks={event.blocks} />
          </div>
        ) : null}
      </Container>
    </>
  );
}
