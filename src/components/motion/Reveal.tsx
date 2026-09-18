"use client";

import { m } from "framer-motion";
import type { ReactNode } from "react";

export type RevealProps = {
  children: ReactNode;
  className?: string;
  /** Delay in seconds before the reveal starts (used to hand-stagger a few elements). */
  delay?: number;
  as?: "div" | "section" | "li" | "span";
};

const tagToComponent = {
  div: m.div,
  section: m.section,
  li: m.li,
  span: m.span,
} as const;

/**
 * Fade + 16px rise entrance, once, when the element enters the viewport.
 * Must be used inside a `MotionProvider` (LazyMotion features provider).
 * Never animates layout properties — only transform/opacity — and fully
 * respects prefers-reduced-motion via MotionConfig's reduceMotion="user".
 */
export function Reveal({ children, className, delay = 0, as = "div" }: RevealProps) {
  const Component = tagToComponent[as];
  return (
    <Component
      className={className}
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-64px" }}
      transition={{ duration: 0.5, ease: "easeOut", delay }}
    >
      {children}
    </Component>
  );
}
