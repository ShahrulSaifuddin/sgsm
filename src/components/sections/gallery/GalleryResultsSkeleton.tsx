import { SkeletonCard } from "@/components/ui/Skeleton";

/**
 * Mirrors GalleryResults' box model (album card grid) so CLS stays 0 when
 * the real data swaps in. Shared between `loading.tsx` (full-route fallback)
 * and the Suspense fallback in `page.tsx` so the two never drift apart.
 */
export function GalleryResultsSkeleton() {
  return (
    <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <SkeletonCard key={i} padding="sm" />
      ))}
    </div>
  );
}
