import { Container } from "@/components/ui/Container";
import { Skeleton, SkeletonText } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <Container size="md" className="py-14">
      <Skeleton className="h-4 w-64" label="Loading event" />
      <Skeleton className="mt-8 h-4 w-48" />
      <Skeleton className="mt-3 h-12 w-full" />
      <Skeleton className="mt-3 h-8 w-3/4" />

      <Skeleton className="mt-8 aspect-video w-full" />

      <div className="mt-10 grid gap-6 sm:grid-cols-2">
        <Skeleton className="h-36 w-full" />
        <Skeleton className="h-36 w-full" />
      </div>

      <SkeletonText className="mt-10" lines={5} />
    </Container>
  );
}
