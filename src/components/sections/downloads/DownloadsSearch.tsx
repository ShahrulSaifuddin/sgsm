"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

export type DownloadsSearchProps = {
  defaultValue: string;
};

const DEBOUNCE_MS = 300;

/**
 * Debounced, URL-driven search box for `/downloads`. Works without JS as a
 * plain `<form method="get">` (Enter or the noscript submit button navigates
 * to `/downloads?q=...`); with JS, typing debounces 300ms before pushing the
 * same URL via the router so results stay shareable and bookmarkable.
 */
export function DownloadsSearch({ defaultValue }: DownloadsSearchProps) {
  const [value, setValue] = useState(defaultValue);
  const router = useRouter();
  const inputId = useId();
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  function handleChange(next: string) {
    setValue(next);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      const params = new URLSearchParams();
      const trimmed = next.trim();
      if (trimmed) params.set("q", trimmed);
      const qs = params.toString();
      router.push(`/downloads${qs ? `?${qs}` : ""}`);
    }, DEBOUNCE_MS);
  }

  return (
    <form
      role="search"
      method="get"
      action="/downloads"
      onSubmit={(event) => event.preventDefault()}
      className="relative max-w-md"
    >
      <label htmlFor={inputId} className="sr-only">
        Search downloads
      </label>
      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-500" aria-hidden="true" />
      <input
        id={inputId}
        name="q"
        type="search"
        value={value}
        onChange={(event) => handleChange(event.target.value)}
        placeholder="Search downloads…"
        className="h-12 w-full rounded-md border border-fairway-900/20 bg-cream-50 pl-11 pr-4 text-base text-ink-900 placeholder:text-ink-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fairway-700"
      />
      <noscript>
        <button
          type="submit"
          className="mt-3 h-11 rounded-md bg-fairway-900 px-5 text-base font-medium text-cream-50 hover:bg-fairway-700"
        >
          Search
        </button>
      </noscript>
    </form>
  );
}
