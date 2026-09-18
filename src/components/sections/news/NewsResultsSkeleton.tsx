import { Skeleton, SkeletonCard } from "@/components/ui/Skeleton";

/**
 * Mirrors NewsResults' box model (filter bar, result count, card grid) so
 * CLS stays 0 when the real data swaps in. Shared between `loading.tsx`
 * (full-route fallback) and the Suspense fallback in `page.tsx` so the two
 * never drift apart.
 */
export function NewsResultsSkeleton() {
  return (
    <>
      <Skeleton className="mt-8 h-24 w-full max-w-sm" label="Loading news" />
      <Skeleton className="mt-6 h-4 w-32" />

      <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonCard key={i} padding="sm" />
        ))}
      </div>
    </>
  );
}
