import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { CalendarDays } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { Badge } from "@/components/ui/Badge";
import { Prose } from "@/components/ui/Prose";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { Reveal } from "@/components/motion/Reveal";
import { getNewsBySlug, listNews, MAX_PER_PAGE } from "@/lib/db/queries";
import { resolveImage } from "@/lib/content";
import { formatDate } from "@/lib/format";

export async function generateStaticParams() {
  const { rows } = await listNews({ per: MAX_PER_PAGE });
  return rows.map((news) => ({ slug: news.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const news = await getNewsBySlug(slug);
  if (!news) return {};

  const description = news.excerpt || `${news.title} — news from the Senior Golfers' Society of Malaysia.`;
  const canonical = `/news/${news.slug}`;

  return {
    title: news.title,
    description,
    alternates: { canonical },
    openGraph: {
      title: news.title,
      description,
      url: canonical,
      type: "article",
      ...(news.image
        ? { images: [{ url: news.image.src, width: news.image.width, height: news.image.height, alt: news.image.alt }] }
        : {}),
    },
  };
}

export default async function NewsDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const news = await getNewsBySlug(slug);
  if (!news) notFound();

  const resolved = news.image ? resolveImage(news.image.src) : null;
  const heroWidth = resolved?.width ?? news.image?.width ?? 1200;
  const heroHeight = resolved?.height ?? news.image?.height ?? 675;
  const blurDataURL = resolved?.blurDataURL ?? news.image?.blurDataURL;

  return (
    <>
      <Container size="lg" className="pt-10 sm:pt-14">
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "News", href: "/news" }, { label: news.title }]} />
      </Container>

      <Container size="md" className="pb-20 pt-6">
        <Reveal>
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="fairway">{news.category}</Badge>
            <p className="flex items-center gap-1.5 text-sm font-medium text-ink-500">
              <CalendarDays className="h-4 w-4" aria-hidden="true" />
              {formatDate(news.date)}
            </p>
          </div>
          <h1 className="mt-4 text-3xl leading-tight sm:text-4xl lg:text-5xl">{news.title}</h1>
        </Reveal>

        {news.image ? (
          <Reveal className="mt-8" delay={0.05}>
            <div
              className="relative overflow-hidden rounded-lg bg-cream-200"
              style={{ aspectRatio: `${heroWidth} / ${heroHeight}` }}
            >
              <Image
                src={news.image.src}
                alt={news.image.alt}
                fill
                sizes="(min-width: 1024px) 768px, 100vw"
                className="object-cover"
                priority
                {...(blurDataURL ? { placeholder: "blur" as const, blurDataURL } : {})}
              />
            </div>
          </Reveal>
        ) : null}

        {news.blocks.length > 0 ? (
          <div className="mt-10">
            <Prose blocks={news.blocks} />
          </div>
        ) : null}
      </Container>
    </>
  );
}
