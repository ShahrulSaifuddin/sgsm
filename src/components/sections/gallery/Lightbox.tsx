"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import type { GalleryImage } from "./AlbumGalleryGrid";

export type LightboxProps = {
  images: GalleryImage[];
  initialIndex: number;
  onClose: () => void;
};

const controlButtonClass =
  "flex h-11 w-11 items-center justify-center rounded-full bg-ink-900/60 text-cream-50 " +
  "transition-colors hover:bg-ink-900/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-300";

/**
 * Full-screen image viewer. Loaded only via `next/dynamic(..., { ssr: false })`
 * from `AlbumGalleryGrid`, and only mounted once a thumbnail is actually
 * clicked, so its code never ships in the gallery page's initial JS.
 *
 * Accessibility: `role="dialog"` + `aria-modal`, a manual focus trap (Tab/
 * Shift+Tab wrap within the dialog), Escape closes, ArrowLeft/ArrowRight
 * navigate, body scroll is locked while open, and focus returns to the
 * triggering thumbnail on close (handled by the parent, which remounts
 * nothing but simply refocuses its stored ref once `onClose` fires).
 */
export default function Lightbox({ images, initialIndex, onClose }: LightboxProps) {
  const [index, setIndex] = useState(initialIndex);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  const image = images[index];

  const goPrev = useCallback(() => {
    setIndex((i) => (i - 1 + images.length) % images.length);
  }, [images.length]);

  const goNext = useCallback(() => {
    setIndex((i) => (i + 1) % images.length);
  }, [images.length]);

  useEffect(() => {
    closeButtonRef.current?.focus();
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        goPrev();
        return;
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        goNext();
        return;
      }
      if (event.key === "Tab") {
        const dialog = dialogRef.current;
        if (!dialog) return;
        const focusable = dialog.querySelectorAll<HTMLElement>(
          'button, [href], [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [goPrev, goNext, onClose]);

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={image.caption || image.alt || "Image viewer"}
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/90 p-4 sm:p-8"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <button
        ref={closeButtonRef}
        type="button"
        onClick={onClose}
        aria-label="Close image viewer"
        className={`${controlButtonClass} absolute right-4 top-4`}
      >
        <X className="h-5 w-5" aria-hidden="true" />
      </button>

      {images.length > 1 ? (
        <button
          type="button"
          onClick={goPrev}
          aria-label="Previous image"
          className={`${controlButtonClass} absolute left-2 sm:left-4`}
        >
          <ChevronLeft className="h-6 w-6" aria-hidden="true" />
        </button>
      ) : null}

      <figure className="flex max-h-[85vh] max-w-[90vw] flex-col items-center gap-3">
        <div className="relative max-h-[80vh] max-w-[90vw]">
          <Image
            src={image.src}
            alt={image.alt}
            width={image.width}
            height={image.height}
            sizes="90vw"
            className="max-h-[80vh] w-auto max-w-[90vw] rounded-md object-contain"
            {...(image.blurDataURL ? { placeholder: "blur" as const, blurDataURL: image.blurDataURL } : {})}
          />
        </div>
        {image.caption ? <figcaption className="text-center text-sm text-cream-100">{image.caption}</figcaption> : null}
      </figure>

      {images.length > 1 ? (
        <button
          type="button"
          onClick={goNext}
          aria-label="Next image"
          className={`${controlButtonClass} absolute right-2 sm:right-4`}
        >
          <ChevronRight className="h-6 w-6" aria-hidden="true" />
        </button>
      ) : null}

      <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-sm text-cream-100" aria-live="polite">
        {index + 1} / {images.length}
      </p>
    </div>
  );
}
