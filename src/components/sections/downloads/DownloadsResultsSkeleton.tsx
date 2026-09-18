import { Skeleton, SkeletonTable } from "@/components/ui/Skeleton";

/**
 * Mirrors DownloadsResults' box model (search bar, result count, table rows)
 * so CLS stays 0 when the real data swaps in. Shared between `loading.tsx`
 * (full-route fallback) and the Suspense fallback in `page.tsx` so the two
 * never drift apart.
 */
export function DownloadsResultsSkeleton() {
  return (
    <>
      <div className="mt-8">
        <Skeleton className="h-12 w-full max-w-md" label="Loading downloads" />
      </div>
      <Skeleton className="mt-6 h-4 w-32" />

      <SkeletonTable className="mt-8" rows={7} columns={1} />
    </>
  );
}
