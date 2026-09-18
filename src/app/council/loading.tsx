import { Container } from "@/components/ui/Container";
import { Skeleton, SkeletonCard } from "@/components/ui/Skeleton";

const GROUP_COUNTS = [26, 4];

export default function Loading() {
  return (
    <article>
      <div className="border-b border-cream-200 bg-cream-100/60">
        <Container size="lg" className="py-12 sm:py-16">
          <div className="max-w-2xl space-y-4">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-12 w-3/4" />
          </div>
        </Container>
      </div>
      <Container size="lg" className="py-12 sm:py-16">
        <Skeleton className="mb-6 h-5 w-64" />
        <div className="space-y-10">
          {GROUP_COUNTS.map((count, groupIndex) => (
            <div key={groupIndex}>
              <Skeleton className="mb-6 h-8 w-56" />
              <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
                {Array.from({ length: count }).map((_, i) => (
                  <SkeletonCard key={i} padding="sm" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </Container>
    </article>
  );
}
