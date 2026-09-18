import { Clock, Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { Card } from "@/components/ui/Card";
import type { SiteConfig } from "@/lib/types";

export type SecondaryPhone = {
  /** Human-readable number, exactly as it appears in the source content. */
  display: string;
  /** `tel:` href built from the same number (spaces stripped). */
  href: string;
};

export type ContactCardsProps = {
  site: SiteConfig;
  /** An additional phone number found in `content/pages/contact-us.json` that isn't in `site.json`. */
  secondaryPhone?: SecondaryPhone | null;
};

const linkRowClass =
  "inline-flex min-h-11 items-center gap-2.5 rounded-md text-base font-medium text-fairway-700 " +
  "underline decoration-fairway-700/40 underline-offset-2 hover:text-fairway-900 hover:decoration-fairway-900 " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fairway-700";

/** Three contact cards (office / hours / get in touch) built from `site.json` — the single source of truth for these details. */
export function ContactCards({ site, secondaryPhone }: ContactCardsProps) {
  const addressLines = [...site.address.lines, `${site.address.postcode} ${site.address.city}`, site.address.country];

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
      <Card padding="lg" className="flex h-full flex-col gap-4">
        <MapPin className="h-7 w-7 text-fairway-700" aria-hidden="true" />
        <h2 className="font-display text-xl text-fairway-950">Our office</h2>
        <address className="not-italic text-base leading-relaxed text-ink-700">
          {addressLines.map((line) => (
            <span key={line} className="block">
              {line}
            </span>
          ))}
        </address>
      </Card>

      <Card padding="lg" className="flex h-full flex-col gap-4">
        <Clock className="h-7 w-7 text-fairway-700" aria-hidden="true" />
        <h2 className="font-display text-xl text-fairway-950">Opening hours</h2>
        <dl className="space-y-1.5 text-base text-ink-700">
          {site.hours.map((entry) => (
            <div key={entry.label} className="flex items-baseline justify-between gap-4">
              <dt className="font-medium text-ink-900">{entry.label}</dt>
              <dd>{entry.value}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <Card padding="lg" className="flex h-full flex-col gap-4">
        <Phone className="h-7 w-7 text-fairway-700" aria-hidden="true" />
        <h2 className="font-display text-xl text-fairway-950">Get in touch</h2>
        <div className="flex flex-col items-start gap-1">
          <a href={`mailto:${site.email}`} className={linkRowClass}>
            <Mail className="h-5 w-5 shrink-0" aria-hidden="true" />
            {site.email}
          </a>
          <a href={site.phoneHref ?? `tel:${site.phone}`} className={linkRowClass}>
            <Phone className="h-5 w-5 shrink-0" aria-hidden="true" />
            {site.phone}
          </a>
          {secondaryPhone ? (
            <a href={secondaryPhone.href} className={linkRowClass}>
              <MessageCircle className="h-5 w-5 shrink-0" aria-hidden="true" />
              {secondaryPhone.display}
            </a>
          ) : null}
        </div>
      </Card>
    </div>
  );
}
