import { Construction } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Reveal } from "@/components/motion/Reveal";

export type ComingSoonProps = {
  title: string;
  description: string;
};

/**
 * Honest "under construction" state for pages whose source content genuinely
 * has nothing to show yet. Never invents content — just says so gracefully
 * and routes visitors to the privileges that do exist.
 */
export function ComingSoon({ title, description }: ComingSoonProps) {
  return (
    <Reveal>
      <Card padding="lg" className="mx-auto flex max-w-2xl flex-col items-center gap-4 text-center">
        <span aria-hidden="true" className="rounded-full bg-fairway-100 p-4 text-fairway-700">
          <Construction className="h-8 w-8" />
        </span>
        <h1 className="text-3xl sm:text-4xl">{title}</h1>
        <p className="text-lg text-ink-700">{description}</p>
        <p className="text-ink-500">
          We&apos;re preparing something exciting for this page — check back soon, or explore the member privileges
          already available today.
        </p>
        <div className="mt-2 flex flex-wrap justify-center gap-3">
          <Button href="/golfing" variant="primary">
            View golfing privileges
          </Button>
          <Button href="/partners-and-sponsors" variant="secondary">
            Partners and sponsors
          </Button>
        </div>
      </Card>
    </Reveal>
  );
}
