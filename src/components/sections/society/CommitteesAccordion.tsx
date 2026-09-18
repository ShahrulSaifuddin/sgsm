import type { Committee } from "@/lib/content";
import { Accordion, type AccordionPanel } from "@/components/ui/Accordion";

/**
 * Renders the 14 working committees as the shared `Accordion` leaf, one
 * panel per committee, each panel listing its members (name + role, when a
 * role is present).
 */
export function CommitteesAccordion({ committees }: { committees: Committee[] }) {
  const panels: AccordionPanel[] = committees.map((committee, index) => ({
    id: `committee-${index}`,
    title: committee.name,
    content: (
      <ul className="divide-y divide-cream-200">
        {committee.members.map((member, memberIndex) => (
          <li key={memberIndex} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2.5">
            <span className="font-medium text-fairway-950">{member.name}</span>
            {member.role ? <span className="text-sm text-fairway-700">{member.role}</span> : null}
          </li>
        ))}
      </ul>
    ),
  }));

  return <Accordion panels={panels} allowMultiple defaultOpenIndexes={[0]} />;
}
