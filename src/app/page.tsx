import type { Metadata } from "next";
import { getPage, getPartners, getSiteConfig } from "@/lib/content";
import type { Block } from "@/lib/types";
import { Hero } from "@/components/sections/home/Hero";
import { NoticesSection } from "@/components/sections/home/NoticesSection";
import { WhoWeAre } from "@/components/sections/home/WhoWeAre";
import { UpcomingEventsSection } from "@/components/sections/home/UpcomingEvents";
import { LatestNewsSection } from "@/components/sections/home/LatestNews";
import { PrivilegesTeaserSection } from "@/components/sections/home/PrivilegesTeaser";
import { PartnerSpotlight } from "@/components/sections/home/PartnerSpotlight";
import { JoinCta } from "@/components/sections/home/JoinCta";

const SLUG = "home";

export function generateMetadata(): Metadata {
  const doc = getPage(SLUG);
  const site = getSiteConfig();
  const description = doc?.description ?? site.tagline;

  return {
    title: site.name,
    description,
    alternates: { canonical: "/" },
    openGraph: {
      title: `${site.name} | ${site.shortName}`,
      description,
      url: "/",
      type: "website",
    },
  };
}

function findBlock<T extends Block["type"]>(blocks: Block[], type: T): Extract<Block, { type: T }> | undefined {
  return blocks.find((block): block is Extract<Block, { type: T }> => block.type === type);
}

/**
 * Home page — the site's front door and main driver of membership sign-ups.
 * Server Component throughout except the `NoticesCarousel` client leaf
 * (loaded via `next/dynamic`, `ssr: false`, deep inside `NoticesSection`).
 *
 * Hero decision: static, text-only hero (see `Hero.tsx`'s doc comment) —
 * the home page's only extracted imagery is a set of seasonal
 * greeting/notice banners (one of which is an unrelated property ad), which
 * are surfaced honestly but modestly in `NoticesSection` below the hero
 * rather than blown up into the site's single most important surface.
 */
export default function HomePage() {
  const doc = getPage(SLUG);
  const site = getSiteConfig();
  const partners = getPartners();

  const blocks = doc?.blocks ?? [];
  const galleryBlock = findBlock(blocks, "gallery");
  const noticeImageBlock = findBlock(blocks, "image");
  const noticeQuoteBlock = findBlock(blocks, "quote");

  const noticeSlides = galleryBlock?.images ?? [];
  const matrixPartner = partners.partners.find((partner) => partner.name.includes("Matrix Concepts")) ?? null;

  return (
    <>
      <Hero site={site} />
      <NoticesSection slides={noticeSlides} />
      <WhoWeAre site={site} />
      <UpcomingEventsSection />
      <LatestNewsSection />
      <PrivilegesTeaserSection />
      <PartnerSpotlight
        photo={noticeImageBlock?.image ?? null}
        caption={noticeQuoteBlock?.html ?? null}
        logo={matrixPartner?.logo ?? null}
      />
      <JoinCta site={site} />
    </>
  );
}
