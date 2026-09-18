import type { Metadata } from "next";
import { Compass } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { SectionHeading } from "@/components/ui/SectionHeading";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: true },
};

/**
 * Sitewide 404. Rendered for any unmatched route, including a stale legacy
 * `/prod/...` URL that isn't covered by a redirect rule in `next.config.ts`.
 */
export default function NotFound() {
  return (
    <Container size="md" className="flex flex-col items-center gap-8 py-24 text-center sm:py-32">
      <span aria-hidden="true" className="text-gold-500">
        <Compass className="h-12 w-12" />
      </span>
      <SectionHeading
        align="center"
        eyebrow="404"
        level={2}
        title="We couldn't find that page"
        intro="The page you're looking for may have moved or no longer exists. Here are a few places to pick back up."
      />
      <div className="flex flex-wrap items-center justify-center gap-4">
        <Button href="/" variant="primary">
          Back to home
        </Button>
        <Button href="/contact-us" variant="secondary">
          Contact us
        </Button>
      </div>
    </Container>
  );
}
