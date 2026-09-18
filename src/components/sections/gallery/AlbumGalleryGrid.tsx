"use client";

import { useRef, useState } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";

export type GalleryImage = {
  id: number;
  src: string;
  alt: string;
  width: number;
  height: number;
  blurDataURL?: string;
  caption: string | null;
};

export type AlbumGalleryGridProps = {
  images: GalleryImage[];
};

// Code-split: the lightbox (and its focus-trap/keyboard-nav logic) is only
// fetched once a thumbnail is actually clicked -- `openIndex` starts `null`,
// so <Lightbox> is never rendered (and therefore never imported) on first
// paint. `ssr: false` is required here because Lightbox touches
// `document`/`window`; it's only permitted because this file is itself a
// Client Component.
const Lightbox = dynamic(() => import("./Lightbox"), { ssr: false });

const GRID_IMAGE_SIZES = "(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw";

/**
 * Masonry-style thumbnail grid (CSS multi-column layout) sized from each
 * image's real width/height, so the grid reserves its final footprint
 * before any image finishes loading -- no reflow, CLS stays ~0.
 */
export function AlbumGalleryGrid({ images }: AlbumGalleryGridProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const triggerRefs = useRef<Array<HTMLButtonElement | null>>([]);

  function handleClose() {
    const previousIndex = openIndex;
    setOpenIndex(null);
    if (previousIndex !== null) {
      // Restore focus to the thumbnail that opened the lightbox.
      triggerRefs.current[previousIndex]?.focus();
    }
  }

  return (
    <>
      <div className="columns-2 gap-4 sm:columns-3 lg:columns-4">
        {images.map((image, index) => (
          <button
            key={image.id}
            ref={(el) => {
              triggerRefs.current[index] = el;
            }}
            type="button"
            onClick={() => setOpenIndex(index)}
            className="mb-4 block w-full break-inside-avoid overflow-hidden rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500"
            aria-label={`View photo ${index + 1} of ${images.length}${image.caption ? `: ${image.caption}` : ""}`}
          >
            <Image
              src={image.src}
              alt={image.alt}
              width={image.width}
              height={image.height}
              sizes={GRID_IMAGE_SIZES}
              className="h-auto w-full rounded-lg object-cover transition-transform duration-200 motion-safe:hover:scale-[1.02]"
              loading="lazy"
              {...(image.blurDataURL ? { placeholder: "blur" as const, blurDataURL: image.blurDataURL } : {})}
            />
          </button>
        ))}
      </div>

      {openIndex !== null ? <Lightbox images={images} initialIndex={openIndex} onClose={handleClose} /> : null}
    </>
  );
}
