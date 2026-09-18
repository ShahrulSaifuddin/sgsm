import { Container } from "@/components/ui/Container";
import { Skeleton } from "@/components/ui/Skeleton";

const HEIGHTS = ["h-56", "h-72", "h-64", "h-48", "h-80", "h-60", "h-52", "h-68", "h-60", "h-72", "h-56", "h-64"];

export default function Loading() {
  return (
    <Container size="lg" className="py-14">
      <Skeleton className="h-4 w-64" label="Loading album" />
      <Skeleton className="mt-8 h-10 w-96 max-w-full" />
      <Skeleton className="mt-3 h-4 w-48" />

      <div className="mt-10 columns-2 gap-4 sm:columns-3 lg:columns-4">
        {HEIGHTS.map((h, i) => (
          <Skeleton key={i} className={`mb-4 w-full break-inside-avoid rounded-lg ${h}`} />
        ))}
      </div>
    </Container>
  );
}
