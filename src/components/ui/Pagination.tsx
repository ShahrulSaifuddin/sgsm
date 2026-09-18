import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";

export type PaginationProps = {
  currentPage: number;
  totalPages: number;
  /** Builds the href for a given page number, e.g. `(page) => \`/news?page=${page}\`` */
  hrefForPage: (page: number) => string;
  className?: string;
  ariaLabel?: string;
};

function pageList(current: number, total: number): (number | "ellipsis")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const pages = new Set<number>([1, total, current, current - 1, current + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);

  const result: (number | "ellipsis")[] = [];
  let prev = 0;
  for (const p of sorted) {
    if (prev && p - prev > 1) result.push("ellipsis");
    result.push(p);
    prev = p;
  }
  return result;
}

const linkBase =
  "inline-flex h-11 min-w-11 items-center justify-center rounded-md px-3 text-sm font-medium " +
  "transition-colors focus-visible:outline-2 focus-visible:outline-offset-2";

/** Accessible prev/next + numbered pagination. Pure links — no client JS required. */
export function Pagination({ currentPage, totalPages, hrefForPage, className, ariaLabel = "Pagination" }: PaginationProps) {
  if (totalPages <= 1) return null;

  const pages = pageList(currentPage, totalPages);
  const hasPrev = currentPage > 1;
  const hasNext = currentPage < totalPages;

  return (
    <nav aria-label={ariaLabel} className={cn("flex items-center justify-center gap-1", className)}>
      {hasPrev ? (
        <Link href={hrefForPage(currentPage - 1)} aria-label="Previous page" className={cn(linkBase, "text-fairway-900 hover:bg-fairway-100")}>
          <ChevronLeft className="h-5 w-5" aria-hidden="true" />
        </Link>
      ) : (
        <span aria-hidden="true" className={cn(linkBase, "text-ink-500/40")}>
          <ChevronLeft className="h-5 w-5" />
        </span>
      )}

      <ul className="flex items-center gap-1">
        {pages.map((p, i) =>
          p === "ellipsis" ? (
            <li key={`ellipsis-${i}`} aria-hidden="true" className="px-2 text-ink-500">
              …
            </li>
          ) : (
            <li key={p}>
              {p === currentPage ? (
                <span aria-current="page" className={cn(linkBase, "bg-fairway-900 text-cream-50")}>
                  {p}
                </span>
              ) : (
                <Link href={hrefForPage(p)} className={cn(linkBase, "text-fairway-900 hover:bg-fairway-100")}>
                  {p}
                </Link>
              )}
            </li>
          )
        )}
      </ul>

      {hasNext ? (
        <Link href={hrefForPage(currentPage + 1)} aria-label="Next page" className={cn(linkBase, "text-fairway-900 hover:bg-fairway-100")}>
          <ChevronRight className="h-5 w-5" aria-hidden="true" />
        </Link>
      ) : (
        <span aria-hidden="true" className={cn(linkBase, "text-ink-500/40")}>
          <ChevronRight className="h-5 w-5" />
        </span>
      )}
    </nav>
  );
}
