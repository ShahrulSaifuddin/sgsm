import { Download, FileText } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { formatDate } from "@/lib/format";
import type { DownloadItem } from "@/lib/db/queries";

export type DownloadListItemProps = {
  download: DownloadItem;
};

/** Formats a byte count as a human-readable size, e.g. "513 KB" or "1.7 MB". */
function formatFileSize(bytes: number | null): string | null {
  if (bytes === null || bytes <= 0) return null;
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  const decimals = unitIndex === 0 || value >= 10 ? 0 : 1;
  return `${value.toFixed(decimals)} ${units[unitIndex]}`;
}

export function DownloadListItem({ download }: DownloadListItemProps) {
  const size = formatFileSize(download.file.size);
  const meta = [download.file.ext?.toUpperCase(), size, download.updated ? `Updated ${formatDate(download.updated)}` : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <Card padding="md" className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <FileText className="mt-0.5 h-6 w-6 shrink-0 text-fairway-700" aria-hidden="true" />
        <div>
          <p className="font-display text-lg text-fairway-950">{download.title}</p>
          {download.description ? <p className="mt-1 text-sm text-ink-700">{download.description}</p> : null}
          {meta ? <p className="mt-1 text-sm text-ink-500">{meta}</p> : null}
        </div>
      </div>
      <Button
        href={download.file.src}
        download
        variant="secondary"
        size="sm"
        icon={<Download className="h-4 w-4" aria-hidden="true" />}
        className="shrink-0 self-start sm:self-center"
      >
        Download
      </Button>
    </Card>
  );
}
