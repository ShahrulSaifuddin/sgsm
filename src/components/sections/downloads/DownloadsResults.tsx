import { FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Pagination } from "@/components/ui/Pagination";
import { EmptyState } from "@/components/ui/EmptyState";
import { Stagger } from "@/components/motion/Stagger";
import { listDownloads } from "@/lib/db/queries";
import { DownloadsSearch } from "@/components/sections/downloads/DownloadsSearch";
import { DownloadListItem } from "@/components/sections/downloads/DownloadListItem";

export type DownloadsRawSearchParams = { page?: string; q?: string };

/**
 * Async data boundary for `/downloads`. Rendered inside a `<Suspense>` from
 * the page shell so the breadcrumbs/heading/intro can stream before the
 * SQLite query resolves; this is where `searchParams` is finally awaited.
 */
export async function DownloadsResults({
  searchParams,
}: {
  searchParams: Promise<DownloadsRawSearchParams>;
}) {
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
    </>
  );
}
