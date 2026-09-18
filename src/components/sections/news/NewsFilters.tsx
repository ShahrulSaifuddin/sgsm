"use client";

import { useId } from "react";
import type { CategoryFacet } from "@/lib/db/queries";

export type NewsFiltersProps = {
  categories: CategoryFacet[];
  current: { category?: string };
};

function titleCase(value: string): string {
  return value.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

const selectClass =
  "h-11 min-w-[9rem] rounded-md border border-fairway-900/20 bg-cream-50 px-3 text-base text-ink-900 " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fairway-700";

/**
 * Progressive-enhancement category filter: a plain `<form method="get">` so
 * filtering works via full navigation with JS disabled, while the select
 * auto-submits on change when JS is available. All state lives in the URL
 * (`?category=`), so results stay shareable/bookmarkable.
 */
export function NewsFilters({ categories, current }: NewsFiltersProps) {
  const formId = useId();

  if (categories.length === 0) return null;

  return (
    <form
      method="get"
      action="/news"
      className="flex flex-wrap items-end gap-4 rounded-lg border border-cream-200 bg-cream-50 p-4 sm:p-5"
      aria-label="Filter news"
    >
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

      <noscript>
        <button
          type="submit"
          className="h-11 rounded-md bg-fairway-900 px-5 text-base font-medium text-cream-50 hover:bg-fairway-700"
        >
          Apply filter
        </button>
      </noscript>
    </form>
  );
}
