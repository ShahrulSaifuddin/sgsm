"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/cn";
import type { SiteConfig } from "@/lib/types";
import { Button } from "@/components/ui/Button";

export type MobileNavProps = {
  site: Pick<SiteConfig, "nav" | "cta" | "shortName">;
  pathname: string;
  open: boolean;
  onClose: () => void;
};

// Matches the CSS "out" transition duration in globals.css (.mobile-drawer-panel).
// Kept mounted for this long after `open` goes false so the slide-out/fade-out
// can actually play before the drawer (and its links) leave the DOM.
const CLOSE_TRANSITION_MS = 200;

function isActive(href: string, pathname: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function getFocusable(panel: HTMLElement | null): HTMLElement[] {
  return panel ? Array.from(panel.querySelectorAll<HTMLElement>('a[href], button:not([disabled])')) : [];
}

/**
 * Full-height right-side drawer with a focus trap, Escape-to-close and a body
 * scroll lock. The drawer slides in from the right while the backdrop fades
 * in; both reverse on close. `render` keeps the panel mounted for the
 * duration of the close transition (`CLOSE_TRANSITION_MS`) so the exit
 * animation can play; `visible` drives the `data-open` attribute that
 * triggers the CSS transition. Under `prefers-reduced-motion: reduce` the
 * transform/opacity transitions are dropped (see globals.css), and the
 * unmount timer collapses to 0ms so nothing is left stuck open.
 */
export function MobileNav({ site, pathname, open, onClose }: MobileNavProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const closeTimeoutRef = useRef<number | null>(null);
  const reducedMotionRef = useRef(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [render, setRender] = useState(false);
  const [visible, setVisible] = useState(false);

  // Track prefers-reduced-motion so the unmount timer never waits on a
  // transition that reduced motion has disabled.
  useEffect(() => {
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedMotionRef.current = mql.matches;
    function onChange() {
      reducedMotionRef.current = mql.matches;
    }
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  // Mount/unmount + entrance/exit timing.
  useEffect(() => {
    let raf = 0;
    if (open) {
      if (closeTimeoutRef.current !== null) {
        window.clearTimeout(closeTimeoutRef.current);
        closeTimeoutRef.current = null;
      }
      previouslyFocusedRef.current = document.activeElement as HTMLElement | null;
      setRender(true);
      // Paint the closed (off-screen) state first, then flip to open on the
      // next frame so the browser actually runs the CSS transition instead
      // of jumping straight to the end state.
      raf = window.requestAnimationFrame(() => setVisible(true));
    } else {
      setVisible(false);
      previouslyFocusedRef.current?.focus();
      const duration = reducedMotionRef.current ? 0 : CLOSE_TRANSITION_MS;
      closeTimeoutRef.current = window.setTimeout(() => {
        setRender(false);
        closeTimeoutRef.current = null;
      }, duration);
    }
    return () => {
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, [open]);

  // Belt-and-braces: clear any pending unmount timer if the component itself
  // ever goes away mid-close.
  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current !== null) window.clearTimeout(closeTimeoutRef.current);
    };
  }, []);

  // Move focus into the panel only once it is actually present and visible
  // (not merely mounted off-screen pre-animation).
  useEffect(() => {
    if (!visible) return;
    getFocusable(panelRef.current)[0]?.focus();
  }, [visible]);

  // Focus trap, Escape-to-close and body scroll lock stay active for the
  // whole time the panel is mounted (including the closing transition) and
  // are torn down only once it actually unmounts — so the scroll lock is
  // released when the drawer finishes closing, not when it starts.
  useEffect(() => {
    if (!render) return;

    document.body.style.overflow = "hidden";

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const focusable = getFocusable(panelRef.current);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [render, onClose]);

  if (!render) return null;

  return (
    <div
      className="fixed inset-0 z-50 lg:hidden"
      role="dialog"
      aria-modal="true"
      aria-label={`${site.shortName} menu`}
      // Non-interactive and hidden from assistive tech while off-screen —
      // both in the single frame before the entrance animation starts and
      // for the whole close transition, so its links are never reachable by
      // Tab once the drawer is closing or closed.
      inert={!visible}
    >
      <button
        type="button"
        aria-hidden="true"
        tabIndex={-1}
        data-open={visible ? "true" : "false"}
        className="mobile-drawer-backdrop absolute inset-0 bg-ink-900/50"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        data-open={visible ? "true" : "false"}
        className="mobile-drawer-panel surface-dark absolute inset-y-0 right-0 flex w-full max-w-sm flex-col overflow-y-auto bg-fairway-950 px-6 py-6 text-cream-50 shadow-lift"
      >
        <div className="mb-6 flex items-center justify-between">
          <span className="font-display text-lg text-cream-50">{site.shortName}</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="flex h-11 w-11 items-center justify-center rounded-md text-cream-50 hover:bg-fairway-900"
          >
            <X className="h-6 w-6" aria-hidden="true" />
          </button>
        </div>

        <nav aria-label="Mobile">
          <ul className="flex flex-col gap-1">
            {site.nav.map((item) => {
              const hasChildren = !!item.children && item.children.length > 0;
              const groupOpen = !!openGroups[item.href];
              const active = isActive(item.href, pathname);
              return (
                <li key={item.href}>
                  {hasChildren ? (
                    <div>
                      <button
                        type="button"
                        aria-expanded={groupOpen}
                        onClick={() => setOpenGroups((prev) => ({ ...prev, [item.href]: !prev[item.href] }))}
                        className="flex w-full items-center justify-between rounded-md px-3 py-3 text-left text-lg hover:bg-fairway-900"
                      >
                        <span aria-current={active ? "page" : undefined}>{item.label}</span>
                        <ChevronDown
                          className={cn("h-5 w-5 transition-transform duration-200", groupOpen && "rotate-180")}
                          aria-hidden="true"
                        />
                      </button>
                      {groupOpen ? (
                        <ul className="ml-3 flex flex-col gap-1 border-l border-cream-50/15 pl-3">
                          {item.children?.map((child) => (
                            <li key={child.href}>
                              <Link
                                href={child.href}
                                onClick={onClose}
                                aria-current={isActive(child.href, pathname) ? "page" : undefined}
                                className="block rounded-md px-3 py-2 text-base text-cream-100 hover:bg-fairway-900"
                              >
                                {child.label}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  ) : (
                    <Link
                      href={item.href}
                      onClick={onClose}
                      aria-current={active ? "page" : undefined}
                      className="block rounded-md px-3 py-3 text-lg hover:bg-fairway-900"
                    >
                      {item.label}
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="mt-6">
          <Button href={site.cta.href} variant="gold" size="lg" className="w-full" onClick={onClose}>
            {site.cta.label}
          </Button>
        </div>
      </div>
    </div>
  );
}
