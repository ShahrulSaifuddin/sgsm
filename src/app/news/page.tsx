import type { Metadata } from "next";
import { Newspaper } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { Pagination } from "@/components/ui/Pagination";
import { EmptyState } from "@/components/ui/EmptyState";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { Reveal } from "@/components/motion/Reveal";
import { Stagger } from "@/components/motion/Stagger";
import { listNews, listNewsCategories } from "@/lib/db/queries";
import { NewsCard } from "@/components/sections/news/NewsCard";
import { NewsFilters } from "@/components/sections/news/NewsFilters";

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

type RawSearchParams = { page?: string; category?: string };

export default async function NewsPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const raw = await searchParams;
  const page = Number(raw.page) || 1;
  const category = raw.category || undefined;

  const [result, categories] = await Promise.all([listNews({ page, category }), listNewsCategories()]);

  function buildHref(overrides: Record<string, string | undefined>): string {
    const merged = { category: raw.category, page: raw.page, ...overrides };
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(merged)) {
      if (value) params.set(key, value);
    }
    const qs = params.toString();
    return `/news${qs ? `?${qs}` : ""}`;
  }

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

        <div className="mt-8">
          <NewsFilters categories={categories} current={{ category }} />
        </div>

        <p className="mt-6 text-sm text-ink-500" aria-live="polite">
          {result.total} post{result.total === 1 ? "" : "s"} found
        </p>

        {result.rows.length === 0 ? (
          <EmptyState
            className="mt-8"
            icon={<Newspaper className="h-10 w-10" aria-hidden="true" />}
            title="No news posts match this filter"
            description="Try a different category."
            action={
              <Button href="/news" variant="secondary">
                Clear filter
              </Button>
            }
          />
        ) : (
          <>
            <Stagger className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {result.rows.map((news, index) => (
                <NewsCard key={news.id} news={news} priority={page === 1 && index === 0 && !category} />
              ))}
            </Stagger>

            <Pagination
              className="mt-12"
              currentPage={result.page}
              totalPages={result.pages}
              hrefForPage={(p) => buildHref({ page: p === 1 ? undefined : String(p) })}
            />
          </>
        )}
      </Container>
    </>
  );
}
