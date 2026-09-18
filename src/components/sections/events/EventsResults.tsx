import { CalendarX2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Pagination } from "@/components/ui/Pagination";
import { EmptyState } from "@/components/ui/EmptyState";
import { Stagger } from "@/components/motion/Stagger";
import { listEvents, listEventYears, listEventCategories, type EventWhen } from "@/lib/db/queries";
import { EventFilters } from "@/components/sections/events/EventFilters";
import { EventCard } from "@/components/sections/events/EventCard";

export type EventsRawSearchParams = { page?: string; year?: string; category?: string; when?: string };

function parseWhen(value?: string): EventWhen {
  if (value === "upcoming" || value === "past" || value === "all") return value;
  return "upcoming";
}

/**
 * Async data boundary for `/events`. Rendered inside a `<Suspense>` from the
 * page shell so the breadcrumbs/heading/intro can stream before the SQLite
 * queries resolve; this is where `searchParams` is finally awaited.
 */
export async function EventsResults({ searchParams }: { searchParams: Promise<EventsRawSearchParams> }) {
  const raw = await searchParams;
  const page = Number(raw.page) || 1;
  const year = raw.year ? Number(raw.year) : undefined;
  const category = raw.category || undefined;
  const when = parseWhen(raw.when);

  const [result, years, categories] = await Promise.all([
    listEvents({ page, year, category, when }),
    listEventYears(),
    listEventCategories(),
  ]);

  function buildHref(overrides: Record<string, string | undefined>): string {
    const merged = { year: raw.year, category: raw.category, when: raw.when, page: raw.page, ...overrides };
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(merged)) {
      if (value) params.set(key, value);
    }
    const qs = params.toString();
    return `/events${qs ? `?${qs}` : ""}`;
  }

  const hasFilters = Boolean(year || category || when !== "upcoming");

  return (
    <>
      <div className="mt-8">
        <EventFilters years={years} categories={categories} current={{ year, category, when }} />
      </div>

      <p className="mt-6 text-sm text-ink-500" aria-live="polite">
        {result.total} event{result.total === 1 ? "" : "s"} found
      </p>

      {result.rows.length === 0 ? (
        <EmptyState
          className="mt-8"
          icon={<CalendarX2 className="h-10 w-10" aria-hidden="true" />}
          title="No events match these filters"
          description="Try a different year, category or timeframe."
          action={
            <Button href="/events" variant="secondary">
              Clear filters
            </Button>
          }
        />
      ) : (
        <>
          <Stagger className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {result.rows.map((event, index) => (
              <EventCard key={event.id} event={event} priority={page === 1 && index === 0 && !hasFilters} />
            ))}
          </Stagger>

          <Pagination
            className="mt-12"
            currentPage={result.page}
            totalPages={result.pages}
            hrefForPage={(p) => buildHref({ page: p === 1 ? undefined : String(p) })}
          />
        </>
      )}
    </>
  );
}
