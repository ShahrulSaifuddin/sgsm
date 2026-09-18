"use client";

import { useEffect, useRef, useState, type FocusEvent, type KeyboardEvent } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Menu } from "lucide-react";
import { cn } from "@/lib/cn";
import type { SiteConfig } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { MobileNav } from "@/components/layout/MobileNav";

export type HeaderProps = {
  site: SiteConfig;
};

function isActive(href: string, pathname: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Sticky, condensing site header. Client Component because it needs
 * `usePathname` (for `aria-current`), scroll position (for the condensed
 * state) and keyboard-driven dropdown menus — the "Header nav behaviour"
 * leaf called out in the contract. Renders the pre-existing `MobileNav`
 * drawer below the `lg` breakpoint.
 */
export function Header({ site }: HeaderProps) {
  const pathname = usePathname();
  const [condensed, setCondensed] = useState(false);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const navRef = useRef<HTMLElement>(null);
  const triggerRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  useEffect(() => {
    function onScroll() {
      setCondensed((prev) => {
        const next = window.scrollY > 24;
        return prev === next ? prev : next;
      });
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close any open menu/drawer whenever the route changes.
  useEffect(() => {
    setOpenMenu(null);
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!openMenu) return;
    function onDocumentClick(event: MouseEvent) {
      if (!navRef.current?.contains(event.target as Node)) setOpenMenu(null);
    }
    document.addEventListener("click", onDocumentClick);
    return () => document.removeEventListener("click", onDocumentClick);
  }, [openMenu]);

  function closeAndRefocus(key: string) {
    setOpenMenu(null);
    triggerRefs.current[key]?.focus();
  }

  function onGroupBlur(event: FocusEvent<HTMLLIElement>, key: string) {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setOpenMenu((prev) => (prev === key ? null : prev));
    }
  }

  function onTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>, key: string, expanded: boolean) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpenMenu(key);
      requestAnimationFrame(() => {
        document.getElementById(`nav-menu-${key}`)?.querySelector<HTMLElement>("a")?.focus();
      });
    } else if (event.key === "Escape" && expanded) {
      closeAndRefocus(key);
    }
  }

  return (
    <header
      className={cn(
        "surface-dark sticky top-0 z-40 bg-fairway-950 text-cream-50 transition-shadow duration-200",
        condensed && "shadow-lift"
      )}
    >
      <div className={cn("mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8", condensed ? "py-2" : "py-4")}>
        <Link href="/" className="flex flex-col justify-center rounded-md leading-tight">
          <span className="font-display text-xl font-semibold text-cream-50 sm:text-2xl">{site.shortName}</span>
          <span className="hidden text-xs tracking-wide text-cream-100 sm:block">{site.name}</span>
        </Link>

        <nav ref={navRef} aria-label="Primary" className="hidden lg:block">
          <ul className="flex items-center gap-1">
            {site.nav.map((item) => {
              const hasChildren = !!item.children && item.children.length > 0;
              const active = isActive(item.href, pathname);

              if (!hasChildren) {
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "block rounded-md px-4 py-3 text-[0.95rem] font-medium hover:bg-fairway-900",
                        active && "text-gold-300"
                      )}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              }

              const expanded = openMenu === item.href;
              return (
                <li key={item.href} className="relative" onBlur={(event) => onGroupBlur(event, item.href)}>
                  <button
                    type="button"
                    ref={(el) => {
                      triggerRefs.current[item.href] = el;
                    }}
                    aria-expanded={expanded}
                    aria-haspopup="true"
                    aria-controls={`nav-menu-${item.href}`}
                    aria-current={active ? "page" : undefined}
                    onClick={() => setOpenMenu(expanded ? null : item.href)}
                    onKeyDown={(event) => onTriggerKeyDown(event, item.href, expanded)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-md px-4 py-3 text-[0.95rem] font-medium hover:bg-fairway-900",
                      active && "text-gold-300"
                    )}
                  >
                    {item.label}
                    <ChevronDown className={cn("h-4 w-4 transition-transform duration-200", expanded && "rotate-180")} aria-hidden="true" />
                  </button>

                  {expanded ? (
                    <div
                      id={`nav-menu-${item.href}`}
                      role="menu"
                      aria-label={item.label}
                      onKeyDown={(event) => {
                        if (event.key === "Escape") closeAndRefocus(item.href);
                      }}
                      className="absolute left-0 top-full z-50 mt-1 min-w-64 rounded-lg border border-cream-50/10 bg-fairway-900 p-2 shadow-lift"
                    >
                      {item.children?.map((child) => (
                        <Link
                          key={child.href}
                          href={child.href}
                          role="menuitem"
                          aria-current={isActive(child.href, pathname) ? "page" : undefined}
                          onClick={() => setOpenMenu(null)}
                          className="block rounded-md px-3 py-2.5 text-[0.95rem] text-cream-100 hover:bg-fairway-950 hover:text-cream-50"
                        >
                          {child.label}
                        </Link>
                      ))}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="flex items-center gap-2">
          <Button href={site.cta.href} variant="gold" size="sm" className="hidden sm:inline-flex">
            {site.cta.label}
          </Button>
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
            aria-haspopup="dialog"
            className="flex h-11 w-11 items-center justify-center rounded-md text-cream-50 hover:bg-fairway-900 lg:hidden"
          >
            <Menu className="h-6 w-6" aria-hidden="true" />
          </button>
        </div>
      </div>

      <MobileNav site={site} pathname={pathname} open={mobileOpen} onClose={() => setMobileOpen(false)} />
    </header>
  );
}
