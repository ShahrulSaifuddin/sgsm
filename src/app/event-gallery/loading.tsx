import { Container } from "@/components/ui/Container";
import { Skeleton } from "@/components/ui/Skeleton";
import { GalleryResultsSkeleton } from "@/components/sections/gallery/GalleryResultsSkeleton";

export default function Loading() {
  return (
    <Container size="lg" className="py-14">
      <Skeleton className="h-4 w-40" label="Loading albums" />
      <Skeleton className="mt-8 h-4 w-24" />
      <Skeleton className="mt-3 h-10 w-64" />
      <Skeleton className="mt-4 h-14 w-full max-w-2xl" />

      <GalleryResultsSkeleton />
    </Container>
  );
}
