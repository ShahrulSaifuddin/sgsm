import { Container } from "@/components/ui/Container";
import { Skeleton, SkeletonCard } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <article>
      <div className="border-b border-cream-200 bg-cream-100/60">
        <Container size="lg" className="py-12 sm:py-16">
          <div className="max-w-2xl space-y-4">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-12 w-3/4" />
            <Skeleton className="h-5 w-full" />
          </div>
        </Container>
      </div>
      <Container size="lg" className="py-12 sm:py-16">
        <Skeleton className="mb-10 h-5 w-64" />
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 10 }).map((_, i) => (
            <SkeletonCard key={i} padding="md" />
          ))}
        </div>
      </Container>
    </article>
  );
}
