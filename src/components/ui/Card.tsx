import type { ElementType, HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

export type CardPadding = "sm" | "md" | "lg";

export type CardProps = {
  as?: ElementType;
  padding?: CardPadding;
  /** Adds a subtle hover lift (transform + shadow only — no layout properties animate). */
  interactive?: boolean;
  className?: string;
  children: ReactNode;
} & Omit<HTMLAttributes<HTMLElement>, "className">;

const paddings: Record<CardPadding, string> = {
  sm: "p-4",
  md: "p-6",
  lg: "p-8",
};

/** Generic bordered surface used throughout the site (news cards, privilege cards, stat tiles…). */
export function Card({ as: Tag = "div", padding = "md", interactive = false, className, children, ...rest }: CardProps) {
  return (
    <Tag
      className={cn(
        "rounded-lg border border-cream-200 bg-cream-50 shadow-soft",
        paddings[padding],
        interactive &&
          "transition-transform duration-200 motion-safe:hover:-translate-y-1 hover:shadow-lift",
        className
      )}
      {...rest}
    >
      {children}
    </Tag>
  );
}
