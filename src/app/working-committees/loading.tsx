import { Container } from "@/components/ui/Container";
import { Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <article>
      <div className="border-b border-cream-200 bg-cream-100/60">
        <Container size="lg" className="py-12 sm:py-16">
          <div className="max-w-2xl space-y-4">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-12 w-3/4" />
            <Skeleton className="h-5 w-40" />
          </div>
        </Container>
      </div>
      <Container size="md" className="py-12 sm:py-16">
        <Skeleton className="mb-8 h-5 w-64" />
        <div className="divide-y divide-cream-200 rounded-lg border border-cream-200 bg-cream-50">
          {Array.from({ length: 14 }).map((_, i) => (
            <div key={i} className="px-5 py-4">
              <Skeleton className="h-6 w-2/3" />
            </div>
          ))}
        </div>
      </Container>
    </article>
  );
}
