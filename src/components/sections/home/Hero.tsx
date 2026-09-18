import Image from "next/image";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { resolveImage } from "@/lib/content";
import type { SiteConfig } from "@/lib/types";

export type HeroProps = {
  site: SiteConfig;
};

/**
 * Curated hero photograph. Deliberately hand-picked (not a dynamic gallery
 * query): the source carousel of seasonal greeting/notice graphics was
 * rejected as "front door" material (one banner is a Chinese New Year
 * greeting, another an unrelated property ad — see `NoticesSection`), but
 * `content/gallery.json` holds 403 genuine SGSM event photographs. This is
 * the Malaysian delegation, in SGSM red, at the 37th ASEAN Senior Amateur
 * Golf Championship 2023 — a tight, well-lit, dignified group shot that
 * still reads clearly at the reduced size a hero panel needs (unlike the
 * large 100+-person course photos also considered, which turn to visual
 * noise once scaled down). Sourced from `content/gallery.json`'s
 * `37th_casga_2023` album; title/caption text below is taken verbatim from
 * that album's `title` field, not invented.
 */
const HERO_PHOTO_SRC = "/images/gallery/37th_casga_2023/2023_asean_bukit_tday1-group.jpg";
const HERO_PHOTO_ALT =
  "Malaysian delegation in SGSM colours at the 37th ASEAN Senior Amateur Golf Championship 2023, Singapore Island Country Club";
const HERO_PHOTO_CAPTION = "37th ASEAN Senior Amateur Golf Championship 2023 — Singapore Island Country Club";

/**
 * The home page's primary hero. Native gallery photos top out at 1200px
 * wide, so this deliberately is NOT a full-bleed 2560px background (that
 * would upscale a 1200px source and look soft) — instead the photo sits in
 * a contained, offset panel next to the copy, rendered at well under its
 * native width at every breakpoint. The panel's aspect-[3/2] box matches
 * the source's actual 1200x800 dimensions exactly, so `object-cover` never
 * has to crop it. The image carries `priority` + `placeholder="blur"` and
 * the section has zero entrance animation, so nothing here delays paint —
 * the LCP candidate (whichever of the H1 or the photo the browser picks)
 * renders on the first frame.
 *
 * Perf investigation note (do not re-attempt without re-measuring first):
 * a native `<picture><source type="image/avif">...<img></picture>` variant
 * serving the pre-built AVIF/WebP from `content/media-manifest.json` was
 * built and measured here (Lighthouse 12, mobile + slow-4G + 4x CPU
 * throttle, `next start` prod build). It was rejected because it
 * *regressed* LCP (Performance 93->89, LCP 3.2s->3.7s) versus this
 * next/image implementation, reproducibly across many runs. Bisection ruled
 * out every other variable -- fetchPriority, decoding, a manual
 * `<link rel="preload">`, srcset width descriptors, and AVIF decode cost all
 * measured at parity with baseline in isolation; only the bare
 * `<picture><source>...</picture>` DOM structure itself reproducibly added
 * ~450ms of Lighthouse-simulated "Render Delay" to the LCP breakdown, with
 * the image's own network fetch already at ~0ms load time in every variant.
 * The LCP phase breakdown here (TTFB ~465ms + Load Time ~0ms + Render Delay
 * ~2200-2800ms, i.e. Render Delay is 70-87% of total LCP) shows the
 * remaining bottleneck is main-thread rendering work unrelated to how the
 * image is served -- consistent with the foreman's own note that warm-cache
 * LCP did not improve either. Bypassing `next/image` for this one element
 * was therefore reverted as a measured null/negative result rather than
 * kept on the strength of the (reasonable, but here false) hypothesis that
 * it would help.
 */
export function Hero({ site }: HeroProps) {
  const resolved = resolveImage(HERO_PHOTO_SRC);

  return (
    <section className="surface-dark relative overflow-hidden bg-fairway-950 text-cream-50">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(201,162,39,0.18),transparent_55%)]"
      />
      <Container size="lg" className="relative py-16 sm:py-20 lg:py-28">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <div>
            <p className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.14em] text-gold-300">
              <span aria-hidden="true" className="h-[2px] w-8 bg-gold-500" />
              Since {site.founded}
            </p>
            <h1 className="text-4xl text-cream-50 sm:text-5xl lg:text-6xl">{site.tagline}</h1>
            <p className="mt-6 max-w-2xl text-lg text-cream-100/90 sm:text-xl">
              Open to Malaysian golfers aged {site.membershipAge}+ and based in Kuala Lumpur, SGSM brings together{" "}
              {site.memberCount} members nationwide for discounted golf, warm fellowship and a full calendar of
              tournaments and social events.
            </p>
            <div className="mt-10 flex flex-wrap gap-4">
              <Button href={site.cta.href} variant="gold" size="lg">
                {site.cta.label}
              </Button>
              <Button href="/about-us" variant="secondary" size="lg">
                Discover our story
              </Button>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-md lg:max-w-none">
            <div className="relative aspect-[3/2] w-full overflow-hidden rounded-3xl shadow-soft ring-1 ring-gold-500/30">
              <Image
                src={HERO_PHOTO_SRC}
                alt={HERO_PHOTO_ALT}
                fill
                priority
                sizes="(min-width: 1024px) 45vw, (min-width: 640px) 60vw, 100vw"
                className="object-cover"
                {...(resolved?.blurDataURL
                  ? { placeholder: "blur" as const, blurDataURL: resolved.blurDataURL }
                  : {})}
              />
              {/* Solid (not gradient) scrim: opaque enough over any underlying pixel
                  that cream-on-scrim contrast stays >= 4.5:1 even behind a
                  worst-case near-white patch of the photo (verified ~6.1:1). */}
              <div className="absolute inset-x-0 bottom-0 bg-fairway-950/90 px-4 py-3 sm:px-5 sm:py-4">
                <p className="text-xs font-medium text-cream-100 sm:text-sm">{HERO_PHOTO_CAPTION}</p>
              </div>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
