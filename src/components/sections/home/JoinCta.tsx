import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { Reveal } from "@/components/motion/Reveal";
import type { SiteConfig } from "@/lib/types";

export type JoinCtaProps = {
  site: SiteConfig;
};

/** The conversion moment: restates eligibility and top benefits, warm and dignified, no fake urgency. */
export function JoinCta({ site }: JoinCtaProps) {
  return (
    <section className="surface-dark bg-fairway-900 text-cream-50">
      <Container size="md" className="py-16 text-center sm:py-20">
        <Reveal>
          <p className="mb-4 flex items-center justify-center gap-2 text-sm font-semibold uppercase tracking-[0.14em] text-gold-300">
            <span aria-hidden="true" className="h-[2px] w-8 bg-gold-500" />
            Membership
          </p>
          <h2 className="text-3xl text-cream-50 sm:text-4xl">
            Join fellow golfers aged {site.membershipAge}+ from across Malaysia
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-cream-100/90">
            Members enjoy discounted green fees at partner clubs nationwide, discounted rooms for golfing holidays,
            and a full calendar of social and competitive events — all in the warm company of fellow senior
            golfers.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Button href={site.cta.href} variant="gold" size="lg">
              {site.cta.label}
            </Button>
            <Button href="/contact-us" variant="secondary" size="lg">
              Ask us a question
            </Button>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
