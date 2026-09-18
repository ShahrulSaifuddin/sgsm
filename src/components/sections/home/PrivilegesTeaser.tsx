import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Reveal } from "@/components/motion/Reveal";
import { PrivilegeGrid } from "@/components/sections/privileges/PrivilegeGrid";
import { getPrivileges } from "@/lib/content";

/** Teaser of partner golf clubs offering member discounts, linking through to the full list. */
export function PrivilegesTeaserSection() {
  const golfing = getPrivileges().golfing;
  const preview = golfing.slice(0, 3);

  if (preview.length === 0) return null;

  return (
    <div className="bg-cream-100/60">
      <Container size="lg" className="py-16 sm:py-24">
        <Reveal>
          <SectionHeading
            eyebrow="Member Privileges"
            title="Golf like a member, everywhere"
            intro={`Discounted green fees await at ${golfing.length} partner clubs across Malaysia.`}
          />
        </Reveal>
        <div className="mt-10">
          <PrivilegeGrid privileges={preview} />
        </div>
        <div className="mt-10">
          <Button href="/golfing" variant="secondary">
            View all golfing privileges
          </Button>
        </div>
      </Container>
    </div>
  );
}
