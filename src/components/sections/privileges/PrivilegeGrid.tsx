import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Stagger } from "@/components/motion/Stagger";
import { resolveImage } from "@/lib/content";
import { truncate } from "@/lib/format";
import type { PrivilegeRef } from "@/lib/content";

export type PrivilegeGridProps = {
  privileges: PrivilegeRef[];
};

const GRID_IMAGE_SIZES = "(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw";

/** Grid of member-privilege club cards (golfing, hotels, others), each linking to its news write-up. */
export function PrivilegeGrid({ privileges }: PrivilegeGridProps) {
  return (
    <Stagger className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {privileges.map((privilege) => {
        const resolved = privilege.image ? resolveImage(privilege.image.src) : null;
        const blurDataURL = resolved?.blurDataURL ?? privilege.image?.blurDataURL;
        return (
          <Link key={privilege.id} href={`/news/${privilege.slug}`} className="group block h-full">
            <Card interactive padding="sm" className="flex h-full flex-col gap-4">
              {privilege.image ? (
                <div className="relative aspect-[4/3] overflow-hidden rounded-md bg-cream-200">
                  <Image
                    src={privilege.image.src}
                    alt={privilege.image.alt}
                    fill
                    sizes={GRID_IMAGE_SIZES}
                    className="object-cover transition-transform duration-200 motion-safe:group-hover:scale-105"
                    loading="lazy"
                    {...(blurDataURL ? { placeholder: "blur" as const, blurDataURL } : {})}
                  />
                </div>
              ) : null}
              <div className="flex flex-1 flex-col gap-2 px-1 pb-1">
                <h3 className="font-display text-lg leading-snug text-fairway-950">{privilege.title}</h3>
                {privilege.summary ? <p className="text-sm text-ink-700">{truncate(privilege.summary, 130)}</p> : null}
                <span className="mt-auto inline-flex items-center gap-1.5 pt-2 text-sm font-medium text-fairway-700">
                  Read more <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </span>
              </div>
            </Card>
          </Link>
        );
      })}
    </Stagger>
  );
}
