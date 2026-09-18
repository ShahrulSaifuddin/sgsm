import Image from "next/image";
import type { CouncilGroup, CouncilMember } from "@/lib/content";
import { Card } from "@/components/ui/Card";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Stagger } from "@/components/motion/Stagger";

const MEMBER_IMAGE_SIZES = "(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw";

/**
 * One council/officer group ("Council Members", "Officers") as a photo-card
 * grid. Portraits arrive at wildly different native aspect ratios (real
 * photos, e.g. 1342x1490 vs 298x426) so every card crops to the same
 * `aspect-[4/5]` frame (`object-cover`, face-safe `object-top`) to keep the
 * grid from going ragged.
 */
export function CouncilGroupSection({ group, index }: { group: CouncilGroup; index: number }) {
  return (
    <section aria-labelledby={`council-group-${index}`} className="py-10 first:pt-0">
      <SectionHeading level={2} title={<span id={`council-group-${index}`}>{group.title}</span>} className="mb-8 max-w-none" />
      <Stagger className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
        {group.members.map((member) => (
          <CouncilMemberCard key={member.name} member={member} />
        ))}
      </Stagger>
    </section>
  );
}

function CouncilMemberCard({ member }: { member: CouncilMember }) {
  return (
    <Card padding="sm" className="flex h-full flex-col gap-3 overflow-hidden">
      <div className="relative -mx-4 -mt-4 aspect-[4/5] overflow-hidden rounded-t-lg bg-cream-200">
        {member.image ? (
          <Image
            src={member.image.src}
            alt={member.image.alt}
            fill
            sizes={MEMBER_IMAGE_SIZES}
            className="object-cover object-top"
            {...(member.image.blurDataURL ? { placeholder: "blur" as const, blurDataURL: member.image.blurDataURL } : {})}
          />
        ) : null}
      </div>
      <div className="flex flex-1 flex-col gap-1">
        <h3 className="text-base leading-snug font-semibold text-fairway-950">{member.name}</h3>
        <p className="text-sm text-fairway-700">{member.role}</p>
        {member.years ? <p className="mt-auto text-xs font-medium tracking-wide text-ink-500">{member.years}</p> : null}
      </div>
    </Card>
  );
}
