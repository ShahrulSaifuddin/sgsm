import Link from "next/link";
import { Mail, Phone } from "lucide-react";
import type { SiteConfig } from "@/lib/types";
import { Container } from "@/components/ui/Container";

export type FooterProps = {
  site: SiteConfig;
};

/**
 * Rich sitewide footer: brand + contact block, three `footerNav` columns,
 * opening hours, affiliation/registration lines and the copyright. Stays a
 * Server Component — nothing here is interactive.
 */
export function Footer({ site }: FooterProps) {
  const phoneHref = site.phoneHref ?? `tel:${site.phone.replace(/[^0-9+]/g, "")}`;
  const year = new Date().getFullYear();

  return (
    <footer className="surface-dark bg-fairway-950 text-cream-100">
      <Container size="lg" className="py-16">
        <div className="grid grid-cols-1 gap-12 sm:grid-cols-2 lg:grid-cols-[1.3fr_1fr_1fr_1fr] lg:gap-8">
          <div>
            <p className="font-display text-2xl text-cream-50">{site.name}</p>
            <p className="mt-3 max-w-sm text-base text-cream-100">{site.tagline}</p>

            <address className="mt-6 space-y-1 text-base not-italic text-cream-100">
              {site.address.lines.map((line) => (
                <p key={line}>{line}</p>
              ))}
              <p>
                {site.address.postcode} {site.address.city}, {site.address.country}
              </p>
            </address>

            <ul className="mt-6 space-y-3 text-base">
              <li>
                <a
                  href={`mailto:${site.email}`}
                  className="inline-flex items-center gap-2 rounded-md text-cream-50 underline decoration-gold-500 underline-offset-4 hover:text-gold-300"
                >
                  <Mail className="h-5 w-5 shrink-0 text-gold-300" aria-hidden="true" />
                  {site.email}
                </a>
              </li>
              <li>
                <a
                  href={phoneHref}
                  className="inline-flex items-center gap-2 rounded-md text-cream-50 underline decoration-gold-500 underline-offset-4 hover:text-gold-300"
                >
                  <Phone className="h-5 w-5 shrink-0 text-gold-300" aria-hidden="true" />
                  {site.phone}
                </a>
              </li>
            </ul>

            {site.hours.length ? (
              <dl className="mt-6 space-y-1 text-base text-cream-100">
                {site.hours.map((hour) => (
                  <div key={hour.label} className="flex gap-2">
                    <dt className="font-medium text-cream-50">{hour.label}:</dt>
                    <dd>{hour.value}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
          </div>

          {site.footerNav.map((column) => (
            <nav key={column.href} aria-label={column.label}>
              <h2 className="font-display text-sm font-semibold uppercase tracking-[0.14em] text-gold-300">{column.label}</h2>
              <ul className="mt-4 space-y-3 text-base">
                {column.children?.map((child) => (
                  <li key={child.href}>
                    <Link href={child.href} className="rounded-md text-cream-100 hover:text-cream-50 hover:underline">
                      {child.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-12 space-y-2 border-t border-cream-50/15 pt-8 text-sm text-cream-100">
          {site.affiliations?.length ? <p>{site.affiliations.join(" · ")}</p> : null}
          {site.registration ? <p>{site.registration}</p> : null}
          <p>
            © {year} {site.name}. All rights reserved.
          </p>
        </div>
      </Container>
    </footer>
  );
}
