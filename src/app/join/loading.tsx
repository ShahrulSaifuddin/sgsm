import { Container } from "@/components/ui/Container";
import { Skeleton, SkeletonCard } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <>
      <div className="border-b border-cream-200 bg-cream-100/60">
        <Container size="lg" className="py-12 sm:py-16">
          <div className="max-w-2xl space-y-4">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-5 w-3/4" />
          </div>
        </Container>
      </div>

      <Container size="lg" className="py-12 sm:py-16">
        <Skeleton className="mb-10 h-5 w-40" />
        <div className="grid gap-12 lg:grid-cols-[1.1fr_1fr]">
          <div className="space-y-12">
            <div className="space-y-3">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-5 w-full" />
            </div>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <SkeletonCard key={i} showImage={false} />
              ))}
            </div>
          </div>
          <SkeletonCard padding="lg" showImage={false} className="h-[560px]" />
        </div>
      </Container>
    </>
  );
}
