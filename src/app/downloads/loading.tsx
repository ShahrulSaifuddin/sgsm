import { Container } from "@/components/ui/Container";
import { Skeleton, SkeletonTable } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <>
      <Container size="lg" className="pt-10 sm:pt-14">
        <Skeleton className="h-5 w-40" />
      </Container>

      <Container size="md" className="pb-20 pt-6">
        <div className="max-w-2xl space-y-3">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-5 w-full max-w-xl" />
        </div>

        <Skeleton className="mt-8 h-12 w-full max-w-md" />
        <Skeleton className="mt-6 h-4 w-32" />

        <SkeletonTable className="mt-8" rows={7} columns={1} />
      </Container>
    </>
  );
}
