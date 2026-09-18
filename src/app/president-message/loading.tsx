import { Container } from "@/components/ui/Container";
import { Skeleton, SkeletonText } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <article>
      <div className="border-b border-cream-200 bg-cream-100/60">
        <Container size="lg" className="py-12 sm:py-16">
          <div className="grid gap-10 lg:grid-cols-[1fr_auto] lg:items-center">
            <div className="max-w-2xl space-y-4">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-12 w-3/4" />
            </div>
            <Skeleton className="mx-auto aspect-[3/4] w-56 sm:w-64" />
          </div>
        </Container>
      </div>
      <Container size="sm" className="py-12 sm:py-16">
        <Skeleton className="mb-10 h-5 w-64" />
        <SkeletonText lines={10} />
      </Container>
    </article>
  );
}
