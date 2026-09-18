import { Container } from "@/components/ui/Container";
import { Skeleton, SkeletonCard } from "@/components/ui/Skeleton";

/** Loading skeleton for the home page, mirroring its section layout so nothing shifts once data arrives. */
export default function Loading() {
  return (
    <>
      {/* Hero */}
      <div className="bg-fairway-950 py-20 sm:py-28">
        <Container size="lg">
          <div className="max-w-3xl space-y-5">
            <Skeleton className="h-4 w-28 bg-cream-50/10" label="Loading" />
            <Skeleton className="h-12 w-full max-w-2xl bg-cream-50/10" />
            <Skeleton className="h-6 w-full max-w-xl bg-cream-50/10" />
            <div className="flex gap-4 pt-4">
              <Skeleton className="h-14 w-44 bg-cream-50/10" />
              <Skeleton className="h-14 w-44 bg-cream-50/10" />
            </div>
          </div>
        </Container>
      </div>

      {/* Notices */}
      <Container size="lg" className="py-16 sm:py-20">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="mt-3 h-9 w-72" />
        <Skeleton className="mt-8 aspect-[4/3] w-full rounded-lg sm:aspect-[21/9]" />
      </Container>

      {/* Who we are */}
      <Container size="lg" className="py-16 sm:py-24">
        <div className="grid gap-12 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-4">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-9 w-80" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-11 w-40" />
          </div>
          <div className="grid grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-lg" />
            ))}
          </div>
        </div>
      </Container>

      {/* Upcoming events */}
      <div className="bg-cream-100/60">
        <Container size="lg" className="py-16 sm:py-24">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="mt-3 h-9 w-64" />
          <Skeleton className="mt-4 h-5 w-full max-w-xl" />
          <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <SkeletonCard key={i} padding="sm" />
            ))}
          </div>
        </Container>
      </div>

      {/* Latest news */}
      <Container size="lg" className="py-16 sm:py-24">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="mt-3 h-9 w-56" />
        <Skeleton className="mt-4 h-5 w-full max-w-xl" />
        <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonCard key={i} padding="sm" />
          ))}
        </div>
      </Container>

      {/* Privileges */}
      <div className="bg-cream-100/60">
        <Container size="lg" className="py-16 sm:py-24">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="mt-3 h-9 w-72" />
          <Skeleton className="mt-4 h-5 w-full max-w-xl" />
          <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <SkeletonCard key={i} padding="sm" />
            ))}
          </div>
        </Container>
      </div>

      {/* Partner */}
      <Container size="lg" className="py-16 sm:py-24">
        <div className="grid gap-10 lg:grid-cols-2">
          <Skeleton className="aspect-[4/3] w-full rounded-lg" />
          <div className="space-y-4">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-9 w-72" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-11 w-48" />
          </div>
        </div>
      </Container>

      {/* Join CTA */}
      <div className="bg-fairway-900 py-16 sm:py-20">
        <Container size="md" className="flex flex-col items-center space-y-4">
          <Skeleton className="h-4 w-28 bg-cream-50/10" />
          <Skeleton className="h-9 w-full max-w-lg bg-cream-50/10" />
          <Skeleton className="h-14 w-48 bg-cream-50/10" />
        </Container>
      </div>
    </>
  );
}
