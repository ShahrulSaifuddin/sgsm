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

function isActive(href: string, pathname: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Full-height right-side drawer with a focus trap, Escape-to-close and a body scroll lock. */
export function MobileNav({ site, pathname, open, onClose }: MobileNavProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!open) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const getFocusable = () =>
      panel ? Array.from(panel.querySelectorAll<HTMLElement>('a[href], button:not([disabled])')) : [];

    getFocusable()[0]?.focus();
    document.body.style.overflow = "hidden";

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const focusable = getFocusable();
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
      previouslyFocused?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label={`${site.shortName} menu`}>
      <button type="button" aria-hidden="true" tabIndex={-1} className="absolute inset-0 bg-ink-900/50" onClick={onClose} />
      <div
        ref={panelRef}
        className="surface-dark absolute inset-y-0 right-0 flex w-full max-w-sm flex-col overflow-y-auto bg-fairway-950 px-6 py-6 text-cream-50 shadow-lift"
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
                          className={cn("h-5 w-5 transition-transform", groupOpen && "rotate-180")}
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
