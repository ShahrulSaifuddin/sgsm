"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/Skeleton";
import type { ImageRef } from "@/lib/types";

// Client-only, code-split entry point for the carousel (contract §6.11/§6.12
// — carousels are dynamically imported and not server-rendered, since they
// are purely a progressive, decorative enhancement over static notices).
// The loading fallback reserves the exact box the carousel renders into so
// there is no layout shift once the chunk arrives.
const NoticesCarousel = dynamic(() => import("./NoticesCarousel").then((mod) => mod.NoticesCarousel), {
  ssr: false,
  loading: () => (
    <Skeleton className="aspect-[4/3] w-full rounded-lg sm:aspect-[21/9]" label="Loading notices" />
  ),
});

export function NoticesCarouselLoader({ slides }: { slides: ImageRef[] }) {
  return <NoticesCarousel slides={slides} />;
}
