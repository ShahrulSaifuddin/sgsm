import { CalendarX2 } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Reveal } from "@/components/motion/Reveal";
import { Stagger } from "@/components/motion/Stagger";
import { listEvents, type EventListItem } from "@/lib/db/queries";
import { EventCard } from "@/components/sections/events/EventCard";

const PER_PAGE = 3;

/**
 * Fetches the next 3 upcoming events. If none are upcoming, falls back to
 * the 3 most recent past events (last page of the "past" list, reversed to
 * newest-first) with an honest heading rather than an empty section.
 */
async function loadHomeEvents(): Promise<{ events: EventListItem[]; isFallback: boolean }> {
  const upcoming = await listEvents({ when: "upcoming", per: PER_PAGE });
  if (upcoming.rows.length > 0) {
    return { events: upcoming.rows, isFallback: false };
  }

  const firstPast = await listEvents({ when: "past", per: PER_PAGE });
  let pastRows = firstPast.rows;
  const lastPage = Math.ceil(firstPast.total / PER_PAGE);
  if (lastPage > 1) {
    const lastPast = await listEvents({ when: "past", per: PER_PAGE, page: lastPage });
    pastRows = lastPast.rows;
  }
  return { events: [...pastRows].reverse(), isFallback: true };
}

export async function UpcomingEventsSection() {
  const { events, isFallback } = await loadHomeEvents();

  return (
    <div className="bg-cream-100/60">
      <Container size="lg" className="py-16 sm:py-24">
        <Reveal>
          <SectionHeading
            eyebrow="What's On"
            title={isFallback ? "Recent Events" : "Upcoming Events"}
            intro={
              isFallback
                ? "No events are currently scheduled — here's a look at what we've recently enjoyed together."
                : "Tournaments, outings and society gatherings — mark your calendar."
            }
          />
        </Reveal>

        {events.length === 0 ? (
          <EmptyState
            className="mt-10"
            icon={<CalendarX2 className="h-10 w-10" aria-hidden="true" />}
            title="No events to show yet"
            description="Check back soon for upcoming tournaments and gatherings."
          />
        ) : (
          <Stagger className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {events.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </Stagger>
        )}

        <div className="mt-10">
          <Button href="/events" variant="secondary">
            View all events
          </Button>
        </div>
      </Container>
    </div>
  );
}
