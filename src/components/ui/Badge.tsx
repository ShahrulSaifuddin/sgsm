import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

export type BadgeVariant = "fairway" | "gold" | "cream";

export type BadgeProps = {
  variant?: BadgeVariant;
  className?: string;
  children: ReactNode;
} & Omit<HTMLAttributes<HTMLSpanElement>, "className">;

const variants: Record<BadgeVariant, string> = {
  fairway: "bg-fairway-100 text-fairway-900",
  gold: "bg-gold-300 text-fairway-950",
  cream: "bg-cream-100 text-ink-700 border border-cream-200",
};

/** Small pill label for categories, event tags, and statuses. */
export function Badge({ variant = "fairway", className, children, ...rest }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1 text-sm font-medium tracking-wide",
        variants[variant],
        className
      )}
      {...rest}
    >
      {children}
    </span>
  );
}
