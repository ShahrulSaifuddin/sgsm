"use client";

import { useId } from "react";
import type { CategoryFacet, EventWhen, YearFacet } from "@/lib/db/queries";

export type EventFiltersProps = {
  years: YearFacet[];
  categories: CategoryFacet[];
  current: { year?: number; category?: string; when: EventWhen };
};

const WHEN_OPTIONS: { value: EventWhen; label: string }[] = [
  { value: "upcoming", label: "Upcoming" },
  { value: "past", label: "Past" },
  { value: "all", label: "All events" },
];

function titleCase(value: string): string {
  return value.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

const selectClass =
  "h-11 min-w-[9rem] rounded-md border border-fairway-900/20 bg-cream-50 px-3 text-base text-ink-900 " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fairway-700";

/**
 * Progressive-enhancement filter bar: a plain `<form method="get">` so
 * filtering works via full navigation with JS disabled (a visible submit
 * button covers that case), while each select auto-submits on change when JS
 * is available. All state lives in the URL (`?year=&category=&when=`), so
 * results are shareable/bookmarkable and this component holds no filter
 * state of its own.
 */
export function EventFilters({ years, categories, current }: EventFiltersProps) {
  const formId = useId();

  return (
    <form
      method="get"
      action="/events"
      className="flex flex-wrap items-end gap-4 rounded-lg border border-cream-200 bg-cream-50 p-4 sm:p-5"
      aria-label="Filter events"
    >
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${formId}-when`} className="text-sm font-medium text-ink-700">
          Timeframe
        </label>
        <select
          id={`${formId}-when`}
          name="when"
          defaultValue={current.when}
          onChange={(event) => event.currentTarget.form?.requestSubmit()}
          className={selectClass}
        >
          {WHEN_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${formId}-year`} className="text-sm font-medium text-ink-700">
          Year
        </label>
        <select
          id={`${formId}-year`}
          name="year"
          defaultValue={current.year ? String(current.year) : ""}
          onChange={(event) => event.currentTarget.form?.requestSubmit()}
          className={selectClass}
        >
          <option value="">All years</option>
          {years.map((y) => (
            <option key={y.year} value={y.year}>
              {y.year} ({y.count})
            </option>
          ))}
        </select>
      </div>

      {categories.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${formId}-category`} className="text-sm font-medium text-ink-700">
            Category
          </label>
          <select
            id={`${formId}-category`}
            name="category"
            defaultValue={current.category ?? ""}
            onChange={(event) => event.currentTarget.form?.requestSubmit()}
            className={selectClass}
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.category} value={c.category}>
                {titleCase(c.category)} ({c.count})
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <noscript>
        <button
          type="submit"
          className="h-11 rounded-md bg-fairway-900 px-5 text-base font-medium text-cream-50 hover:bg-fairway-700"
        >
          Apply filters
        </button>
      </noscript>
    </form>
  );
}
