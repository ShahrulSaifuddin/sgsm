"use client";

import { useEffect } from "react";
import "./globals.css";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { SectionHeading } from "@/components/ui/SectionHeading";

/**
 * Last-resort error boundary: catches errors thrown by the root layout
 * itself (where `error.tsx` can't help, since it renders *inside* the
 * layout). Next.js requires this file to render its own <html>/<body> since
 * the root layout is presumed broken; `globals.css` is imported directly so
 * the design tokens/fonts fallback still applies instead of an unstyled page.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body className="antialiased">
        <Container size="md" className="flex flex-col items-center gap-8 py-24 text-center sm:py-32">
          <SectionHeading
            align="center"
            eyebrow="Something went wrong"
            level={2}
            title="The site hit an unexpected error"
            intro="Please try again, or come back a little later."
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
      </body>
    </html>
  );
}
