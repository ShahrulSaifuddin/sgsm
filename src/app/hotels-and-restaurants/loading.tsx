import { Container } from "@/components/ui/Container";
import { Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <Container size="lg" className="py-12 sm:py-16">
      <Skeleton className="mb-10 h-5 w-64" />
      <Skeleton className="mx-auto h-72 w-full max-w-2xl" />
    </Container>
  );
}
