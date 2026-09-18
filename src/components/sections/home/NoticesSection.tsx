import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Reveal } from "@/components/motion/Reveal";
import { NoticesCarouselLoader } from "./NoticesCarouselLoader";
import type { ImageRef } from "@/lib/types";

export type NoticesSectionProps = {
  slides: ImageRef[];
};

/** Renders the source home page's own rotating notice/greeting banners as a modest, below-the-fold strip. */
export function NoticesSection({ slides }: NoticesSectionProps) {
  if (slides.length === 0) return null;

  return (
    <Container size="lg" className="py-16 sm:py-20">
      <Reveal>
        <SectionHeading eyebrow="Notices" title="Latest notices and greetings" />
      </Reveal>
      <div className="mt-8">
        <NoticesCarouselLoader slides={slides} />
      </div>
    </Container>
  );
}
