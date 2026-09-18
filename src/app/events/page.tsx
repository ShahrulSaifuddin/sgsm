import type { Metadata } from "next";
import { Suspense } from "react";
import { Container } from "@/components/ui/Container";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { Reveal } from "@/components/motion/Reveal";
import { EventsResults, type EventsRawSearchParams } from "@/components/sections/events/EventsResults";
import { EventsResultsSkeleton } from "@/components/sections/events/EventsResultsSkeleton";

export const metadata: Metadata = {
  title: "Events",
  description:
    "Upcoming and past tournaments, outings and society gatherings hosted by the Senior Golfers' Society of Malaysia.",
  alternates: { canonical: "/events" },
  openGraph: {
    title: "Events | SGSM",
    description: "Upcoming and past tournaments, outings and society gatherings hosted by SGSM.",
    url: "/events",
    type: "website",
  },
};

/**
 * Not `async` — `searchParams` is passed straight through to `EventsResults`
 * without being awaited here, so this shell (breadcrumbs, heading, intro) can
 * stream immediately while the SQLite queries resolve inside the Suspense boundary.
 */
export default function EventsPage({ searchParams }: { searchParams: Promise<EventsRawSearchParams> }) {
  return (
    <>
      <Container size="lg" className="pt-10 sm:pt-14">
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Events" }]} />
      </Container>

      <Container size="lg" className="pb-20 pt-6">
        <Reveal>
          <p className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.14em] text-fairway-700">
            <span aria-hidden="true" className="h-[2px] w-8 bg-gold-500" />
            What&apos;s on
          </p>
          <h1 className="text-3xl sm:text-4xl">Events</h1>
          <p className="mt-4 max-w-2xl text-lg text-ink-700">
            Tournaments, outings and society gatherings — past and upcoming.
          </p>
        </Reveal>

        <Suspense fallback={<EventsResultsSkeleton />}>
          <EventsResults searchParams={searchParams} />
        </Suspense>
      </Container>
    </>
  );
}
