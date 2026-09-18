import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type SectionHeadingProps = {
  eyebrow?: string;
  title: ReactNode;
  intro?: ReactNode;
  align?: "left" | "center";
  /** Heading level for the title — defaults to h2 for section-level headings. */
  level?: 2 | 3;
  className?: string;
};

/**
 * Eyebrow text uses fairway-700 (not gold — gold-500/600 fails AA at this
 * size on cream) with a small decorative gold rule for the heritage accent.
 */
export function SectionHeading({
  eyebrow,
  title,
  intro,
  align = "left",
  level = 2,
  className,
}: SectionHeadingProps) {
  const Heading = level === 3 ? "h3" : "h2";
  return (
    <div className={cn("max-w-2xl", align === "center" && "mx-auto text-center", className)}>
      {eyebrow ? (
        <p
          className={cn(
            "mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.14em] text-fairway-700",
            align === "center" && "justify-center"
          )}
        >
          <span aria-hidden="true" className="h-[2px] w-8 bg-gold-500" />
          {eyebrow}
        </p>
      ) : null}
      <Heading className={cn("text-3xl sm:text-4xl", level === 3 && "text-2xl sm:text-3xl")}>{title}</Heading>
      {intro ? <p className="mt-4 text-lg text-ink-700">{intro}</p> : null}
    </div>
  );
}
