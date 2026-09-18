import type { MetadataRoute } from "next";
import siteJson from "../../content/site.json";
import type { SiteConfig } from "@/lib/types";

const site = siteJson as SiteConfig;

/**
 * Web app manifest. Colours match the design tokens in `globals.css`
 * (fairway-900 / cream-50, contract §5).
 *
 * Icon note: the only icon asset that actually exists anywhere in this repo
 * is `src/app/favicon.ico` (served by Next's file convention at
 * `/favicon.ico`) -- there is no `public/icon-192.png`, `apple-touch-icon.png`
 * or similar. Per the "don't invent files" rule, this manifest references
 * only that one real icon rather than fabricating PNG sizes that don't exist.
 * A follow-up asset pass should add proper 192/512 PNG icons.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: site.name,
    short_name: site.shortName,
    description: site.tagline,
    start_url: "/",
    display: "standalone",
    background_color: "#FBF9F4",
    theme_color: "#0B3B2E",
    icons: [
      {
        src: "/favicon.ico",
        sizes: "any",
        type: "image/x-icon",
      },
    ],
  };
}
