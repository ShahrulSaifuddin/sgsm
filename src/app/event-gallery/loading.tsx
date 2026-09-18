import { Container } from "@/components/ui/Container";
import { Skeleton, SkeletonCard } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <Container size="lg" className="py-14">
      <Skeleton className="h-4 w-40" label="Loading albums" />
      <Skeleton className="mt-8 h-4 w-24" />
      <Skeleton className="mt-3 h-10 w-64" />
      <Skeleton className="mt-4 h-14 w-full max-w-2xl" />

      <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonCard key={i} padding="sm" />
        ))}
      </div>
    </Container>
  );
}
