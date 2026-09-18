import type { CSSProperties } from "react";
import { cn } from "@/lib/cn";

export type SkeletonProps = {
  className?: string;
  style?: CSSProperties;
  /** Adds `sr-only` loading text for assistive tech; visuals stay decorative otherwise. */
  label?: string;
};

/**
 * Base pulsing placeholder block. `motion-safe:` gates the pulse so
 * prefers-reduced-motion visitors just see a static block, never a
 * flashing one.
 */
export function Skeleton({ className, style, label }: SkeletonProps) {
  return (
    <div
      className={cn("motion-safe:animate-pulse rounded-md bg-cream-200", className)}
      style={style}
      role="status"
      aria-live="polite"
    >
      {label ? <span className="sr-only">{label}</span> : null}
    </div>
  );
}

export type SkeletonTextProps = {
  lines?: number;
  className?: string;
  /** Width of the last line, so paragraphs don't look like a solid block. */
  lastLineWidth?: string;
};

/** Mirrors a paragraph's box model: a stack of text-height bars. */
export function SkeletonText({ lines = 3, className, lastLineWidth = "60%" }: SkeletonTextProps) {
  return (
    <div className={cn("space-y-2", className)} aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className="h-4 w-full"
          {...(i === lines - 1 ? { style: { width: lastLineWidth } } : {})}
        />
      ))}
    </div>
  );
}

export type SkeletonCardProps = {
  className?: string;
  /** Matches Card's padding scale so the placeholder occupies the same box. */
  padding?: "sm" | "md" | "lg";
  showImage?: boolean;
};

const paddings = { sm: "p-4", md: "p-6", lg: "p-8" } as const;

/** Mirrors Card's box model (border, radius, padding) plus an image + title + text stack. */
export function SkeletonCard({ className, padding = "md", showImage = true }: SkeletonCardProps) {
  return (
    <div
      className={cn("rounded-lg border border-cream-200 bg-cream-50 shadow-soft", paddings[padding], className)}
      aria-hidden="true"
    >
      {showImage ? <Skeleton className="mb-4 aspect-[4/3] w-full" /> : null}
      <Skeleton className="mb-3 h-6 w-3/4" />
      <SkeletonText lines={2} />
    </div>
  );
}

export type SkeletonTableProps = {
  rows?: number;
  columns?: number;
  className?: string;
};

/** Mirrors a bordered data table's box model (header row + body rows) for lists like Downloads or Past Presidents. */
export function SkeletonTable({ rows = 6, columns = 3, className }: SkeletonTableProps) {
  return (
    <div
      className={cn("overflow-hidden rounded-lg border border-cream-200 bg-cream-50", className)}
      aria-hidden="true"
    >
      <div className="flex gap-4 border-b border-cream-200 bg-cream-100 px-4 py-3 sm:px-6">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} className="h-4 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-4 border-b border-cream-200 px-4 py-4 last:border-b-0 sm:px-6">
          {Array.from({ length: columns }).map((_, c) => (
            <Skeleton key={c} className="h-4 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}
