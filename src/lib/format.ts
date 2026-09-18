/**
 * Formatting helpers shared across the app: dates in the en-MY locale, event
 * date ranges, and plain-text truncation.
 */

const LOCALE = "en-MY";

const LONG_DATE: Intl.DateTimeFormatOptions = { day: "numeric", month: "long", year: "numeric" };
const SHORT_DATE: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" };
const TIME: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit" };

function toDate(value: string | Date): Date {
  return typeof value === "string" ? new Date(value) : value;
}

/** Formats a date as "5 May 1931" (en-MY), or with custom Intl options. */
export function formatDate(value: string | Date, options: Intl.DateTimeFormatOptions = LONG_DATE): string {
  return new Intl.DateTimeFormat(LOCALE, options).format(toDate(value));
}

/** Formats a date as "5 May 2025" using an abbreviated month — good for dense lists/tables. */
export function formatDateShort(value: string | Date): string {
  return new Intl.DateTimeFormat(LOCALE, SHORT_DATE).format(toDate(value));
}

/** Formats a time as "9:00 AM" (en-MY). */
export function formatTime(value: string | Date): string {
  return new Intl.DateTimeFormat(LOCALE, TIME).format(toDate(value));
}

/**
 * Formats an event's start/end into a single human-readable range, e.g.:
 *  - same day, all-day:    "12 March 2025"
 *  - same day, timed:      "12 March 2025, 9:00 AM – 1:00 PM"
 *  - same month:           "12–14 March 2025"
 *  - spanning months/years:"28 March 2025 – 2 April 2025"
 */
export function formatEventDateRange(startDate: string, endDate: string, allDay = true): string {
  const start = toDate(startDate);
  const end = toDate(endDate);

  const sameDay = start.toDateString() === end.toDateString();
  if (sameDay) {
    const datePart = formatDate(start, LONG_DATE);
    if (allDay) return datePart;
    return `${datePart}, ${formatTime(start)} – ${formatTime(end)}`;
  }

  const sameMonthAndYear = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
  if (sameMonthAndYear) {
    const startDay = new Intl.DateTimeFormat(LOCALE, { day: "numeric" }).format(start);
    return `${startDay}–${formatDate(end, LONG_DATE)}`;
  }

  return `${formatDate(start, LONG_DATE)} – ${formatDate(end, LONG_DATE)}`;
}

/** Truncates text to at most maxLength characters, breaking on a word boundary, with an ellipsis. */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  const cut = text.slice(0, maxLength);
  const lastSpace = cut.lastIndexOf(" ");
  const base = lastSpace > maxLength * 0.6 ? cut.slice(0, lastSpace) : cut;
  return `${base.trimEnd()}…`;
}
