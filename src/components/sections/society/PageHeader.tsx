import Image from "next/image";
import type { ImageRef } from "@/lib/types";
import { Container } from "@/components/ui/Container";
import { Reveal } from "@/components/motion/Reveal";

export type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  image?: ImageRef | null;
};

const HERO_IMAGE_SIZES = "(min-width: 1024px) 384px, (min-width: 640px) 50vw, 100vw";

/**
 * Shared `<h1>` banner for the Introduction routes. Built locally because the
 * shared `SectionHeading` (src/components/ui/SectionHeading.tsx) only emits
 * `<h2>`/`<h3>` — there is no shared component for the page-level `<h1>`
 * heading these routes need, so this fills that gap without touching
 * `components/ui`.
 *
 * When an `image` is supplied it is treated as this page's LCP element
 * (`priority`, eagerly loaded, no blur wait) — every other image on these
 * routes is lazy.
 */
export function PageHeader({ eyebrow, title, subtitle, image }: PageHeaderProps) {
  return (
    <div className="border-b border-cream-200 bg-cream-100/60">
      <Container size="lg" className="py-12 sm:py-16">
        <div className={image ? "grid gap-10 lg:grid-cols-[1fr_auto] lg:items-center" : ""}>
          <Reveal>
            <div className="max-w-2xl">
              {eyebrow ? (
                <p className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.14em] text-fairway-700">
                  <span aria-hidden="true" className="h-[2px] w-8 bg-gold-500" />
                  {eyebrow}
                </p>
              ) : null}
              <h1 className="text-4xl sm:text-5xl">{title}</h1>
              {subtitle ? <p className="mt-4 text-lg text-ink-700">{subtitle}</p> : null}
            </div>
          </Reveal>

          {image ? (
            <Reveal delay={0.08}>
              <div className="relative mx-auto aspect-[3/4] w-56 overflow-hidden rounded-lg shadow-lift sm:w-64">
                <Image
                  src={image.src}
                  alt={image.alt}
                  fill
                  sizes={HERO_IMAGE_SIZES}
                  priority
                  className="object-cover"
                  {...(image.blurDataURL ? { placeholder: "blur" as const, blurDataURL: image.blurDataURL } : {})}
                />
              </div>
            </Reveal>
          ) : null}
        </div>
      </Container>
    </div>
  );
}
