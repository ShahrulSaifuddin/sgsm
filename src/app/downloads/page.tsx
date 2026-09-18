import type { Metadata } from "next";
import { FolderOpen } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { Pagination } from "@/components/ui/Pagination";
import { EmptyState } from "@/components/ui/EmptyState";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { Reveal } from "@/components/motion/Reveal";
import { Stagger } from "@/components/motion/Stagger";
import { listDownloads } from "@/lib/db/queries";
import { DownloadsSearch } from "@/components/sections/downloads/DownloadsSearch";
import { DownloadListItem } from "@/components/sections/downloads/DownloadListItem";

export const metadata: Metadata = {
  title: "Downloads",
  description: "Forms, guides and reports available for download from the Senior Golfers' Society of Malaysia.",
  alternates: { canonical: "/downloads" },
  openGraph: {
    title: "Downloads | SGSM",
    description: "Forms, guides and reports available for download from SGSM.",
    url: "/downloads",
    type: "website",
  },
};

type RawSearchParams = { page?: string; q?: string };

export default async function DownloadsPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const raw = await searchParams;
  const page = Number(raw.page) || 1;
  const q = raw.q || undefined;

  const result = await listDownloads({ page, q });

  function hrefForPage(p: number): string {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return `/downloads${qs ? `?${qs}` : ""}`;
  }

  return (
    <>
      <Container size="lg" className="pt-10 sm:pt-14">
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Downloads" }]} />
      </Container>

      <Container size="md" className="pb-20 pt-6">
        <Reveal>
          <p className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.14em] text-fairway-700">
            <span aria-hidden="true" className="h-[2px] w-8 bg-gold-500" />
            Forms &amp; reports
          </p>
          <h1 className="text-3xl sm:text-4xl">Downloads</h1>
          <p className="mt-4 max-w-2xl text-lg text-ink-700">
            Application forms, member guides and Society reports, ready to download.
          </p>
        </Reveal>

        <div className="mt-8">
          <DownloadsSearch defaultValue={q ?? ""} />
        </div>

        <p className="mt-6 text-sm text-ink-500" aria-live="polite">
          {result.total} file{result.total === 1 ? "" : "s"} found
        </p>

        {result.rows.length === 0 ? (
          <EmptyState
            className="mt-8"
            icon={<FolderOpen className="h-10 w-10" aria-hidden="true" />}
            title="No downloads match your search"
            description="Try a different keyword."
            action={
              <Button href="/downloads" variant="secondary">
                Clear search
              </Button>
            }
          />
        ) : (
          <>
            <Stagger as="ul" className="mt-8 flex list-none flex-col gap-4">
              {result.rows.map((download) => (
                <DownloadListItem key={download.id} download={download} />
              ))}
            </Stagger>

            <Pagination className="mt-12" currentPage={result.page} totalPages={result.pages} hrefForPage={hrefForPage} />
          </>
        )}
      </Container>
    </>
  );
}
