"use client";

import { LazyMotion, domAnimation, MotionConfig } from "framer-motion";
import type { ReactNode } from "react";

export type MotionProviderProps = {
  children: ReactNode;
};

/**
 * Sitewide motion setup. `LazyMotion` keeps the animation engine out of the
 * initial bundle (only `m.*` components below may be used — never `motion.*`).
 * `reducedMotion="user"` automatically honours `prefers-reduced-motion` for
 * every animation in the tree without any manual matchMedia plumbing.
 *
 * This is a client leaf: the Server Component `layout.tsx` renders it and
 * passes Header/main/Footer through as `children`, so those subtrees stay
 * Server Components wherever they don't need their own interactivity.
 */
export function MotionProvider({ children }: MotionProviderProps) {
  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user" transition={{ duration: 0.5, ease: "easeOut" }}>
        {children}
      </MotionConfig>
    </LazyMotion>
  );
}
