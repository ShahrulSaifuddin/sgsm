import Image from "next/image";
import { Card } from "@/components/ui/Card";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Stagger } from "@/components/motion/Stagger";
import { resolveImage } from "@/lib/content";
import type { Partner } from "@/lib/content";

export type PartnersGridProps = {
  partners: Partner[];
};

const LOGO_SIZES = "(min-width: 1024px) 220px, (min-width: 640px) 33vw, 45vw";

function groupByNote(partners: Partner[]): Map<string, Partner[]> {
  const groups = new Map<string, Partner[]>();
  for (const partner of partners) {
    const key = partner.note ?? "Partners";
    const list = groups.get(key) ?? [];
    list.push(partner);
    groups.set(key, list);
  }
  return groups;
}

function PartnerLogo({ partner }: { partner: Partner }) {
  const resolved = partner.logo ? resolveImage(partner.logo.src) : null;
  const blurDataURL = resolved?.blurDataURL ?? partner.logo?.blurDataURL;

  const body = (
    <Card padding="md" className="flex h-full items-center justify-center">
      {partner.logo ? (
        <div className="relative h-24 w-full">
          <Image
            src={partner.logo.src}
            alt={partner.logo.alt || partner.name}
            fill
            sizes={LOGO_SIZES}
            className="object-contain"
            loading="lazy"
            {...(blurDataURL ? { placeholder: "blur" as const, blurDataURL } : {})}
          />
        </div>
      ) : (
        <p className="text-center font-display text-lg text-fairway-950">{partner.name}</p>
      )}
    </Card>
  );

  if (!partner.url) return body;

  return (
    <a href={partner.url} target="_blank" rel="noopener noreferrer" aria-label={partner.name} className="block h-full">
      {body}
    </a>
  );
}

/** Groups partners by their `note` (e.g. "Collaboration Partners", "Hole-In-One Sponsors") into labeled sections. */
export function PartnersGrid({ partners }: PartnersGridProps) {
  const groups = groupByNote(partners);

  return (
    <div className="space-y-12">
      {[...groups.entries()].map(([label, group]) => (
        <div key={label}>
          <SectionHeading level={3} title={label} />
          <Stagger className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {group.map((partner) => (
              <PartnerLogo key={partner.name} partner={partner} />
            ))}
          </Stagger>
        </div>
      ))}
    </div>
  );
}
