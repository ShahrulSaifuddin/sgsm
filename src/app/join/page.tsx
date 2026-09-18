import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { CalendarCheck2, Download, FileText, Handshake, MapPinned, Users } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { Reveal } from "@/components/motion/Reveal";
import { Stagger } from "@/components/motion/Stagger";
import { getSiteConfig } from "@/lib/content";

// The application form is a client leaf (state, fetch, focus management);
// code-splitting it keeps the persuasive pitch content above in the initial
// server-rendered HTML for SEO and fast first paint. `ssr: false` is not
// permitted on `next/dynamic` inside a Server Component, so this still
// server-renders the form markup -- it's the JS bundle that's deferred.
const JoinForm = dynamic(() => import("@/components/sections/join/JoinForm").then((mod) => mod.JoinForm));

export const metadata: Metadata = {
  title: "Join SGSM",
  description:
    "Become a member of the Senior Golfers' Society of Malaysia. Open to Malaysians aged 55 and above — enjoy discounted green fees, golfcation room rates and a community of senior golfers.",
  alternates: { canonical: "/join" },
  openGraph: {
    title: "Join SGSM | Senior Golfers' Society of Malaysia",
    description:
      "Become a member of the Senior Golfers' Society of Malaysia. Open to Malaysians aged 55 and above.",
    url: "/join",
    type: "website",
  },
};

const MEMBERSHIP_FORM_PDF = "/files/new-application-membership-2024.pdf";

const BENEFITS = [
  {
    icon: MapPinned,
    title: "Discounted green fees",
    body: "Enjoy reduced green fees at partner clubs and resorts across Malaysia — see the full list of golfing privileges.",
  },
  {
    icon: Handshake,
    title: "Golfcation room rates",
    body: "Get discounted rooms at partner clubs when you want to make a golfing trip, or \"golfcation\", of it.",
  },
  {
    icon: CalendarCheck2,
    title: "Year-round events",
    body: "Take part in social and competitive events held throughout the year, hosted by the Society.",
  },
  {
    icon: Users,
    title: "A community of senior golfers",
    body: "Join 3,800+ members who share a love of the game and the friendships that come with it.",
  },
];

export default function JoinPage() {
  const site = getSiteConfig();

  return (
    <>
      <div className="border-b border-cream-200 bg-cream-100/60">
        <Container size="lg" className="py-12 sm:py-16">
          <Reveal>
            <p className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.14em] text-fairway-700">
              <span aria-hidden="true" className="h-[2px] w-8 bg-gold-500" />
              Become a member
            </p>
            <h1 className="max-w-3xl text-4xl sm:text-5xl">Join the Senior Golfers&apos; Society of Malaysia</h1>
            <p className="mt-5 max-w-2xl text-lg text-ink-700">
              Founded in {site.founded}, SGSM is Malaysia&apos;s foremost society for veteran golfers, {site.memberCount}{" "}
              members strong. Membership is open to Malaysians aged {site.membershipAge}+ who share a love of the
              game.
            </p>
          </Reveal>
        </Container>
      </div>

      <Container size="lg" className="py-12 sm:py-16">
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Join SGSM" }]} className="mb-10" />

        <div className="grid gap-12 lg:grid-cols-[1.1fr_1fr] lg:items-start">
          <div className="space-y-12">
            <Reveal>
              <h2 className="text-2xl sm:text-3xl">Who can join</h2>
              <p className="mt-4 text-lg text-ink-700">
                Membership is open to all Malaysians aged {site.membershipAge} and above. Whether you already
                belong to a golf club or simply love the game, SGSM welcomes senior golfers from across the
                country.
              </p>
            </Reveal>

            <Reveal delay={0.05}>
              <h2 className="text-2xl sm:text-3xl">Member benefits</h2>
              <Stagger className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2">
                {BENEFITS.map((benefit) => (
                  <Card key={benefit.title} padding="md" className="flex h-full flex-col gap-3">
                    <benefit.icon className="h-7 w-7 text-fairway-700" aria-hidden="true" />
                    <h3 className="font-display text-lg text-fairway-950">{benefit.title}</h3>
                    <p className="text-base text-ink-700">{benefit.body}</p>
                  </Card>
                ))}
              </Stagger>
            </Reveal>

            <Reveal delay={0.1}>
              <Card padding="md" className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <FileText className="mt-0.5 h-7 w-7 shrink-0 text-fairway-700" aria-hidden="true" />
                  <div>
                    <p className="font-display text-lg text-fairway-950">Prefer a paper application?</p>
                    <p className="mt-1 text-base text-ink-700">
                      Membership at SGSM is processed via a printed application form. Download it, complete it, and
                      submit it to the Society office — or use the online form alongside for a faster start.
                    </p>
                  </div>
                </div>
                <Button
                  href={MEMBERSHIP_FORM_PDF}
                  download
                  variant="secondary"
                  icon={<Download className="h-5 w-5" aria-hidden="true" />}
                  className="shrink-0 self-start sm:self-center"
                >
                  Download application form
                </Button>
              </Card>
            </Reveal>
          </div>

          <Reveal delay={0.05} className="lg:sticky lg:top-8">
            <Card padding="lg">
              <h2 className="text-2xl">Apply online</h2>
              <p className="mt-2 text-base text-ink-700">
                Tell us a little about yourself and our council will follow up with the next steps.
              </p>
              <div className="mt-6">
                <JoinForm />
              </div>
            </Card>
          </Reveal>
        </div>
      </Container>
    </>
  );
}
