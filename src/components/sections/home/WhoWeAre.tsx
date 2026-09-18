import { Container } from "@/components/ui/Container";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Reveal } from "@/components/motion/Reveal";
import { Stagger } from "@/components/motion/Stagger";
import type { SiteConfig } from "@/lib/types";

export type WhoWeAreProps = {
  site: SiteConfig;
};

/** Warm introduction to the Society using only verified facts from `content/site.json`, with a link to the full story. */
export function WhoWeAre({ site }: WhoWeAreProps) {
  const stats = [
    { label: "Founded", value: site.founded },
    { label: "Members", value: site.memberCount },
    { label: "Membership age", value: site.membershipAge ? `${site.membershipAge}+` : undefined },
  ].filter((stat): stat is { label: string; value: string } => Boolean(stat.value));

  return (
    <Container size="lg" className="py-16 sm:py-24">
      <div className="grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
        <Reveal>
          <SectionHeading
            eyebrow="Who We Are"
            title="A society for golfers who never stop playing"
            intro={
              <>
                {site.foundedNote} Membership is open to Malaysian golfers aged {site.membershipAge} and above, and
                the Society has grown into a fellowship of {site.memberCount} members nationwide, based at our own
                clubhouse in {site.address.city} since 2016.
                {site.affiliations && site.affiliations.length > 0 ? ` SGSM is a member of ${site.affiliations[0]}.` : ""}
              </>
            }
          />
          <div className="mt-8">
            <Button href="/about-us" variant="secondary">
              Read our full story
            </Button>
          </div>
        </Reveal>

        {stats.length > 0 ? (
          <Stagger className="grid grid-cols-3 gap-4">
            {stats.map((stat) => (
              <Card key={stat.label} padding="sm" className="text-center">
                <p className="font-display text-3xl text-fairway-950 sm:text-4xl">{stat.value}</p>
                <p className="mt-1 text-sm text-ink-500">{stat.label}</p>
              </Card>
            ))}
          </Stagger>
        ) : null}
      </div>
    </Container>
  );
}
