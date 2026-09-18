"use client";

import { useEffect } from "react";
import { TriangleAlert } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { SectionHeading } from "@/components/ui/SectionHeading";

/**
 * Route-segment error boundary. Next.js renders this in place of the segment
 * that threw, keeping the root layout (header/footer/nav) intact. Must be a
 * Client Component -- error boundaries only work as client components in the
 * App Router -- and receives `reset()` to retry rendering the segment.
 */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <Container size="md" className="flex flex-col items-center gap-8 py-24 text-center sm:py-32">
      <span aria-hidden="true" className="text-gold-500">
        <TriangleAlert className="h-12 w-12" />
      </span>
      <SectionHeading
        align="center"
        eyebrow="Something went wrong"
        level={2}
        title="This page hit a snag"
        intro="Please try again, or head back to the homepage. If this keeps happening, let us know."
      />
      <div className="flex flex-wrap items-center justify-center gap-4">
        <Button type="button" variant="primary" onClick={reset}>
          Try again
        </Button>
        <Button href="/" variant="secondary">
          Back to home
        </Button>
      </div>
    </Container>
  );
}
