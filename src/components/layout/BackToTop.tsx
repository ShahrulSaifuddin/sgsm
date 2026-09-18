"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUp } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Floating "back to top" control.
 *
 * Several pages here are genuinely long -- the gallery albums, the 49-event
 * list, the 39-row past presidents table -- so this saves a lot of scrolling
 * on a phone.
 *
 * Behaviour notes:
 * - Hidden until the reader is past `SHOW_AFTER_PX`, so it never covers
 *   content on a short page.
 * - The scroll listener is passive and coalesced into a single
 *   `requestAnimationFrame` per frame, and it only calls `setVisible` when the
 *   boolean actually flips, so scrolling does not spam React re-renders
 *   (contract §6.14).
 * - Only `opacity`/`transform` are animated, never layout properties
 *   (contract §5 motion rules).
 * - Smooth scrolling is skipped when the reader has asked for reduced motion;
 *   they get an instant jump instead.
 * - After scrolling, keyboard focus is moved back to the skip link at the top
 *   of the document, so a keyboard or screen-reader user is actually returned
 *   to the start of the page rather than left stranded mid-document.
 */

const SHOW_AFTER_PX = 400;

export function BackToTop() {
  const [visible, setVisible] = useState(false);
  const frame = useRef<number | null>(null);

  useEffect(() => {
    const update = () => {
      frame.current = null;
      const next = window.scrollY > SHOW_AFTER_PX;
      // Only re-render on an actual state change, not on every scroll event.
      setVisible((prev) => (prev === next ? prev : next));
    };

    const onScroll = () => {
      if (frame.current !== null) return;
      frame.current = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame.current !== null) window.cancelAnimationFrame(frame.current);
    };
  }, []);

  const handleClick = useCallback(() => {
    const prefersReduced =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Order matters. Moving focus *after* starting a smooth scroll aborts the
    // animation and the page teleports to the top instead of gliding there --
    // measured in-browser: scroll-then-focus sampled [1500, 1500, 0, 0, ...]
    // (an instant jump), whereas focus-then-scroll sampled
    // [1438, 686, 243, 86, 19, 0] (a real animation). `preventScroll` stops the
    // focus call itself from jumping the viewport, so focusing first is safe.
    const skipLink = document.querySelector<HTMLElement>(".skip-link");
    skipLink?.focus({ preventScroll: true });

    window.scrollTo({ top: 0, behavior: prefersReduced ? "auto" : "smooth" });
  }, []);

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label="Back to top"
      // Hidden from assistive tech and keyboard order while off-screen, so it
      // is never a focus trap on a short page.
      aria-hidden={!visible}
      tabIndex={visible ? 0 : -1}
      className={cn(
        "fixed bottom-5 right-5 z-40 inline-flex h-12 w-12 items-center justify-center rounded-full sm:bottom-8 sm:right-8",
        "bg-fairway-900 text-cream-50 shadow-lg shadow-fairway-950/20",
        "transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none",
        "hover:-translate-y-1 hover:bg-fairway-700",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500 focus-visible:ring-offset-2 focus-visible:ring-offset-cream-50",
        visible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-2 opacity-0"
      )}
    >
      <ArrowUp aria-hidden="true" className="h-5 w-5" />
    </button>
  );
}
