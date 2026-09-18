import { Container } from "@/components/ui/Container";
import { Skeleton, SkeletonCard } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <>
      <Container size="lg" className="pt-10 sm:pt-14">
        <Skeleton className="h-5 w-40" />
      </Container>

      <Container size="lg" className="pb-20 pt-6">
        <div className="max-w-2xl space-y-3">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-5 w-full max-w-xl" />
        </div>

        <Skeleton className="mt-8 h-24 w-full max-w-sm" />
        <Skeleton className="mt-6 h-4 w-32" />

        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} padding="sm" />
          ))}
        </div>
      </Container>
    </>
  );
}
