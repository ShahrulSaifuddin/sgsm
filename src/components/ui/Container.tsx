import type { ElementType, HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

export type ContainerSize = "sm" | "md" | "lg" | "full";

export type ContainerProps = {
  as?: ElementType;
  size?: ContainerSize;
  className?: string;
  children: ReactNode;
} & Omit<HTMLAttributes<HTMLElement>, "className">;

const sizes: Record<ContainerSize, string> = {
  sm: "max-w-3xl",
  md: "max-w-5xl",
  lg: "max-w-7xl",
  full: "max-w-none",
};

/** Centered, responsively-gutter'd content wrapper used on every page. */
export function Container({ as: Tag = "div", size = "lg", className, children, ...rest }: ContainerProps) {
  return (
    <Tag className={cn("mx-auto w-full px-4 sm:px-6 lg:px-8", sizes[size], className)} {...rest}>
      {children}
    </Tag>
  );
}
