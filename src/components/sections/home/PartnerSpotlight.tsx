import Image from "next/image";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Reveal } from "@/components/motion/Reveal";
import { resolveImage } from "@/lib/content";
import type { ImageRef } from "@/lib/types";

export type PartnerSpotlightProps = {
  photo: ImageRef | null;
  caption: string | null;
  logo: ImageRef | null;
};

/** Highlights the Society's collaboration partner (Matrix Concepts Holdings Berhad) using the home page's own extracted notice content. */
export function PartnerSpotlight({ photo, caption, logo }: PartnerSpotlightProps) {
  const resolvedPhoto = photo ? resolveImage(photo.src) : null;
  const photoBlur = resolvedPhoto?.blurDataURL ?? photo?.blurDataURL;

  return (
    <Container size="lg" className="py-16 sm:py-24">
      <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
        {photo ? (
          <Reveal>
            <figure>
              <div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-cream-200 shadow-soft">
                <Image
                  src={photo.src}
                  alt={photo.alt}
                  fill
                  sizes="(min-width: 1024px) 50vw, 100vw"
                  className="object-cover"
                  loading="lazy"
                  {...(photoBlur ? { placeholder: "blur" as const, blurDataURL: photoBlur } : {})}
                />
              </div>
              {caption ? <figcaption className="mt-3 text-sm text-ink-500">{caption}</figcaption> : null}
            </figure>
          </Reveal>
        ) : null}

        <Reveal delay={photo ? 0.08 : 0}>
          <SectionHeading
            eyebrow="Collaboration Partner"
            title="Matrix Concepts Holdings Berhad"
            intro="SGSM has partnered with Matrix Concepts Holdings Berhad — a property development group also active in construction, education, hospitality and healthcare — as our main sponsor and collaboration partner, supporting the Society's events and activities nationwide."
          />
          <div className="mt-8 flex flex-wrap items-center gap-6">
            {logo ? (
              <div className="relative h-16 w-32 shrink-0">
                <Image src={logo.src} alt={logo.alt} fill sizes="128px" className="object-contain" loading="lazy" />
              </div>
            ) : null}
            <Button href="/collaborative-partnership" variant="secondary">
              About this partnership
            </Button>
          </div>
        </Reveal>
      </div>
    </Container>
  );
}
