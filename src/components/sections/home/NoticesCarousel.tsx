"use client";

import { useCallback, useEffect, useId, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";
import type { ImageRef } from "@/lib/types";

export type NoticesCarouselProps = {
  slides: ImageRef[];
  /** Milliseconds between auto-advances. */
  intervalMs?: number;
};

/**
 * Client-only carousel for the home page's rotating notice/greeting banners.
 * Auto-advances only when the visitor has not requested reduced motion,
 * pauses on hover or focus, and exposes fully keyboard-operable prev/next +
 * dot controls with real `aria-label`s. A visually-hidden `aria-live`
 * region announces slide changes politely. Only ever animates `opacity`.
 */
export function NoticesCarousel({ slides, intervalMs = 6000 }: NoticesCarouselProps) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const regionId = useId();

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (reducedMotion || paused || slides.length <= 1) return;
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % slides.length);
    }, intervalMs);
    return () => clearInterval(timer);
  }, [reducedMotion, paused, slides.length, intervalMs]);

  const goTo = useCallback(
    (i: number) => {
      setIndex(((i % slides.length) + slides.length) % slides.length);
    },
    [slides.length]
  );

  if (slides.length === 0) return null;

  const current = slides[index];

  return (
    <div
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setPaused(false);
      }}
    >
      <div
        id={regionId}
        role="region"
        aria-roledescription="carousel"
        aria-label="Notices and greetings"
        className="relative aspect-[4/3] w-full overflow-hidden rounded-lg bg-cream-200 shadow-soft sm:aspect-[21/9]"
      >
        {slides.map((slide, i) => (
          <div
            key={slide.src}
            aria-hidden={i !== index}
            className={cn("absolute inset-0 transition-opacity duration-500 ease-out", i === index ? "opacity-100" : "opacity-0")}
          >
            <Image
              src={slide.src}
              alt={slide.alt}
              fill
              sizes="(min-width: 1024px) 896px, 100vw"
              className="object-cover"
              loading={i === 0 ? "eager" : "lazy"}
              {...(slide.blurDataURL ? { placeholder: "blur" as const, blurDataURL: slide.blurDataURL } : {})}
            />
          </div>
        ))}

        {slides.length > 1 ? (
          <>
            <button
              type="button"
              onClick={() => goTo(index - 1)}
              aria-label="Previous notice"
              aria-controls={regionId}
              className="absolute left-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-fairway-950/70 text-cream-50 transition-colors hover:bg-fairway-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500"
            >
              <ChevronLeft className="h-5 w-5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => goTo(index + 1)}
              aria-label="Next notice"
              aria-controls={regionId}
              className="absolute right-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-fairway-950/70 text-cream-50 transition-colors hover:bg-fairway-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500"
            >
              <ChevronRight className="h-5 w-5" aria-hidden="true" />
            </button>
          </>
        ) : null}

        <span className="sr-only" aria-live="polite" aria-atomic="true">
          {`Notice ${index + 1} of ${slides.length}: ${current.alt || "SGSM"}`}
        </span>
      </div>

      {slides.length > 1 ? (
        <div className="mt-4 flex justify-center gap-1">
          {slides.map((slide, i) => (
            <button
              key={slide.src}
              type="button"
              onClick={() => goTo(i)}
              aria-label={`Go to notice ${i + 1} of ${slides.length}`}
              aria-current={i === index ? "true" : undefined}
              className="flex h-11 w-11 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fairway-700"
            >
              <span
                aria-hidden="true"
                className={cn("h-3 w-3 rounded-full transition-colors", i === index ? "bg-gold-500" : "bg-cream-200")}
              />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
