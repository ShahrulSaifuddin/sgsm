import Image from "next/image";
import type { PatronGroup, PatronPerson } from "@/lib/content";
import { Card } from "@/components/ui/Card";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Stagger } from "@/components/motion/Stagger";

const PATRON_IMAGE_SIZES = "(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 60vw";

/**
 * One patrons/honorary-members group. Royal/vice-regal honours strings run
 * 200+ characters (all-caps, comma-separated) — cards never truncate them;
 * the name/title column simply grows taller, and a single-person group (the
 * Royal Patron) is given a wider, centered card instead of stretching to
 * fill a 3-up grid meant for larger groups.
 */
export function PatronGroupSection({ group, index }: { group: PatronGroup; index: number }) {
  const isSingle = group.people.length === 1;
  return (
    <section aria-labelledby={`patron-group-${index}`} className="py-10 first:pt-0">
      <SectionHeading level={2} title={<span id={`patron-group-${index}`}>{group.title}</span>} className="mb-8 max-w-none" />
      <Stagger
        className={isSingle ? "grid grid-cols-1 justify-items-center" : "grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3"}
      >
        {group.people.map((person) => (
          <PatronCard key={person.name} person={person} wide={isSingle} />
        ))}
      </Stagger>
    </section>
  );
}

function PatronCard({ person, wide }: { person: PatronPerson; wide: boolean }) {
  return (
    <Card padding="lg" className={wide ? "flex w-full max-w-2xl flex-col items-center gap-6 text-center sm:flex-row sm:text-left" : "flex h-full flex-col gap-4 text-center sm:text-left"}>
      {person.image ? (
        <div
          className={
            wide
              ? "relative aspect-[3/4] w-40 shrink-0 overflow-hidden rounded-lg bg-cream-200 sm:w-48"
              : "relative mx-auto aspect-[3/4] w-40 overflow-hidden rounded-lg bg-cream-200 sm:mx-0"
          }
        >
          <Image
            src={person.image.src}
            alt={person.image.alt}
            fill
            sizes={PATRON_IMAGE_SIZES}
            className="object-cover object-top"
            {...(person.image.blurDataURL ? { placeholder: "blur" as const, blurDataURL: person.image.blurDataURL } : {})}
          />
        </div>
      ) : null}
      <div className="flex flex-1 flex-col gap-2">
        <h3 className="text-lg leading-snug font-semibold text-fairway-950">{person.name}</h3>
        {person.title ? (
          <p className="text-sm leading-relaxed break-words text-ink-500">{person.title}</p>
        ) : null}
      </div>
    </Card>
  );
}
