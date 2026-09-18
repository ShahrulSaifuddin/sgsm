import { Newspaper } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Reveal } from "@/components/motion/Reveal";
import { Stagger } from "@/components/motion/Stagger";
import { listNews } from "@/lib/db/queries";
import { NewsCard } from "@/components/sections/news/NewsCard";

export async function LatestNewsSection() {
  const result = await listNews({ per: 3 });

  return (
    <Container size="lg" className="py-16 sm:py-24">
      <Reveal>
        <SectionHeading eyebrow="News" title="Latest News" intro="Updates, announcements and stories from the SGSM family." />
      </Reveal>

      {result.rows.length === 0 ? (
        <EmptyState
          className="mt-10"
          icon={<Newspaper className="h-10 w-10" aria-hidden="true" />}
          title="No news yet"
          description="Check back soon for the latest updates."
        />
      ) : (
        <Stagger className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {result.rows.map((news) => (
            <NewsCard key={news.id} news={news} />
          ))}
        </Stagger>
      )}

      <div className="mt-10">
        <Button href="/news" variant="secondary">
          Read all news
        </Button>
      </div>
    </Container>
  );
}
