"use client";

import { m } from "framer-motion";
import { Children, isValidElement, type ReactNode } from "react";

export type StaggerProps = {
  children: ReactNode;
  className?: string;
  /** Seconds between each child's entrance — capped per contract at 0.08s (80ms). */
  delayStep?: number;
  as?: "div" | "ul";
};

const MAX_DELAY_STEP = 0.08;

/**
 * Wraps each direct child in its own fade + rise reveal, staggered by up to
 * 80ms per item. The wrapper itself becomes the grid/flex container, so
 * `<Stagger className="grid grid-cols-3">` lays its children out normally —
 * each child is simply promoted to an `m.div` for its own entrance animation.
 */
export function Stagger({ children, className, delayStep = MAX_DELAY_STEP, as = "div" }: StaggerProps) {
  const items = Children.toArray(children);
  const step = Math.min(delayStep, MAX_DELAY_STEP);
  const Wrapper = as;
  const ItemComponent = as === "ul" ? m.li : m.div;

  return (
    <Wrapper className={className}>
      {items.map((child, i) => (
        <ItemComponent
          key={isValidElement(child) && child.key !== null ? child.key : i}
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-64px" }}
          transition={{ duration: 0.5, ease: "easeOut", delay: i * step }}
        >
          {child}
        </ItemComponent>
      ))}
    </Wrapper>
  );
}
