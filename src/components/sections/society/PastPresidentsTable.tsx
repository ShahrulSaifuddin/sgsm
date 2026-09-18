import type { PastPresidentRow } from "@/lib/content";

/**
 * Dignified archival table of every SGSM president since 1931. Renders a
 * real `<table>` (with `<caption>` + `scope`'d headers) for `md` and up, and
 * a stacked, still-labelled list below `md` so the 39-row roll of honour
 * never forces horizontal scrolling on a phone.
 */
export function PastPresidentsTable({ rows, caption }: { rows: PastPresidentRow[]; caption: string }) {
  return (
    <>
      <div className="hidden overflow-hidden rounded-lg border border-cream-200 bg-cream-50 shadow-soft md:block">
        <table className="w-full border-collapse text-left">
          <caption className="border-b border-cream-200 bg-cream-100 px-6 py-4 text-left font-display text-lg text-fairway-950">
            {caption}
          </caption>
          <thead>
            <tr className="border-b border-cream-200 bg-cream-100">
              <th scope="col" className="w-20 px-6 py-3 text-sm font-semibold uppercase tracking-wide text-fairway-700">
                No.
              </th>
              <th scope="col" className="px-6 py-3 text-sm font-semibold uppercase tracking-wide text-fairway-700">
                Name
              </th>
              <th scope="col" className="w-48 px-6 py-3 text-sm font-semibold uppercase tracking-wide text-fairway-700">
                Years
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.no} className="border-b border-cream-200 last:border-b-0 even:bg-cream-100/40">
                <td className="px-6 py-3 text-sm text-ink-500">{row.no}</td>
                <td className="px-6 py-3 font-medium text-fairway-950">{row.name}</td>
                <td className="px-6 py-3 text-sm text-ink-700">{row.years}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ol
        className="divide-y divide-cream-200 rounded-lg border border-cream-200 bg-cream-50 shadow-soft md:hidden"
        aria-label={caption}
      >
        {rows.map((row) => (
          <li key={row.no} className="flex items-start justify-between gap-4 px-4 py-3">
            <span className="flex items-baseline gap-3">
              <span aria-hidden="true" className="text-sm font-semibold text-fairway-700">
                {row.no}.
              </span>
              <span className="font-medium text-fairway-950">{row.name}</span>
            </span>
            <span className="shrink-0 text-sm text-ink-500">{row.years}</span>
          </li>
        ))}
      </ol>
    </>
  );
}
