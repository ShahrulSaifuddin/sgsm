import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";
import type { SiteConfig } from "@/lib/types";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { MotionProvider } from "@/components/motion/MotionProvider";
import { BackToTop } from "@/components/layout/BackToTop";
import siteJson from "../../content/site.json";

// content/site.json is owned by another worker and read-only here; cast to
// the shared SiteConfig shape this design-system module owns.
const site = siteJson as SiteConfig;

// The domain this rebuild replaces (contract §0) — used for metadataBase and
// OpenGraph, not fabricated content.
const SITE_URL = "https://www.sgsm.com.my";

const fraunces = Fraunces({
  variable: "--font-display-raw",
  subsets: ["latin"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-sans-raw",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${site.name} | ${site.shortName}`,
    template: `%s | ${site.shortName}`,
  },
  description: site.tagline,
  openGraph: {
    title: site.name,
    description: site.tagline,
    siteName: site.name,
    url: SITE_URL,
    locale: "en_MY",
    type: "website",
  },
};

function organizationJsonLd(config: SiteConfig) {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: config.name,
    alternateName: config.shortName,
    url: SITE_URL,
    foundingDate: config.founded,
    email: config.email,
    telephone: config.phone,
    address: {
      "@type": "PostalAddress",
      streetAddress: config.address.lines.join(", "),
      addressLocality: config.address.city,
      postalCode: config.address.postcode,
      addressCountry: config.address.country,
    },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const jsonLd = organizationJsonLd(site);

  return (
    <html lang="en" className={`${fraunces.variable} ${inter.variable}`}>
      <body className="antialiased">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        <MotionProvider>
          <Header site={site} />
          <main id="main">{children}</main>
          <Footer site={site} />
          <BackToTop />
        </MotionProvider>
      </body>
    </html>
  );
}
