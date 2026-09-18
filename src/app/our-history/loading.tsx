import { Container } from "@/components/ui/Container";
import { Skeleton, SkeletonText } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <article>
      <div className="border-b border-cream-200 bg-cream-100/60">
        <Container size="lg" className="py-12 sm:py-16">
          <div className="max-w-2xl space-y-4">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-12 w-3/4" />
            <Skeleton className="h-5 w-full" />
          </div>
        </Container>
      </div>
      <Container size="sm" className="py-12 sm:py-16">
        <Skeleton className="mb-10 h-5 w-64" />
        <SkeletonText lines={6} />
        <Skeleton className="my-6 aspect-[4/3] w-full max-w-md" />
        <SkeletonText lines={6} />
      </Container>
    </article>
  );
}
