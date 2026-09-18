import type { Block, ImageRef } from "@/lib/types";

/**
 * Finds the first real image inside a `Block[]` tree (top-level image /
 * gallery blocks) so `generateMetadata`/`export const metadata` can populate
 * OpenGraph `images` without a page needing its own `hero` image. Returns
 * `null` when the page has no image block — metadata omits `images` rather
 * than inventing one.
 */
export function firstBlockImage(blocks: Block[]): ImageRef | null {
  for (const block of blocks) {
    if (block.type === "image") return block.image;
    if (block.type === "gallery" && block.images[0]) return block.images[0];
  }
  return null;
}
