import { Container } from "@/components/ui/Container";
import { Skeleton, SkeletonText } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <>
      <Container size="lg" className="pt-10 sm:pt-14">
        <Skeleton className="h-5 w-56" />
      </Container>

      <Container size="md" className="pb-20 pt-6">
        <div className="flex gap-3">
          <Skeleton className="h-7 w-24 rounded-full" />
          <Skeleton className="h-7 w-32 rounded-full" />
        </div>
        <Skeleton className="mt-4 h-12 w-3/4" />
        <Skeleton className="mt-8 aspect-video w-full" />
        <SkeletonText lines={8} className="mt-10" />
      </Container>
    </>
  );
}
