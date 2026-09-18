import type { Metadata } from "next";
import { Suspense } from "react";
import { Container } from "@/components/ui/Container";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { Reveal } from "@/components/motion/Reveal";
import { NewsResults, type NewsRawSearchParams } from "@/components/sections/news/NewsResults";
import { NewsResultsSkeleton } from "@/components/sections/news/NewsResultsSkeleton";

export const metadata: Metadata = {
  title: "News",
  description: "Latest news and announcements from the Senior Golfers' Society of Malaysia.",
  alternates: { canonical: "/news" },
  openGraph: {
    title: "News | SGSM",
    description: "Latest news and announcements from the Senior Golfers' Society of Malaysia.",
    url: "/news",
    type: "website",
  },
};

/**
 * Not `async` — `searchParams` is passed straight through to `NewsResults`
 * without being awaited here, so this shell (breadcrumbs, heading, intro) can
 * stream immediately while the SQLite queries resolve inside the Suspense boundary.
 */
export default function NewsPage({ searchParams }: { searchParams: Promise<NewsRawSearchParams> }) {
  return (
    <>
      <Container size="lg" className="pt-10 sm:pt-14">
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "News" }]} />
      </Container>

      <Container size="lg" className="pb-20 pt-6">
        <Reveal>
          <p className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.14em] text-fairway-700">
            <span aria-hidden="true" className="h-[2px] w-8 bg-gold-500" />
            Stay informed
          </p>
          <h1 className="text-3xl sm:text-4xl">News</h1>
          <p className="mt-4 max-w-2xl text-lg text-ink-700">
            Announcements, member updates and golfing privilege news from the Society.
          </p>
        </Reveal>

        <Suspense fallback={<NewsResultsSkeleton />}>
          <NewsResults searchParams={searchParams} />
        </Suspense>
      </Container>
    </>
  );
}
