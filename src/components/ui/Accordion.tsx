"use client";

import { useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";

export type AccordionPanel = {
  /** Unique id used to derive the header/panel DOM ids — must be unique on the page. */
  id: string;
  title: string;
  content: ReactNode;
};

export type AccordionProps = {
  panels: AccordionPanel[];
  className?: string;
  /** Multiple panels may stay open at once — gentler for older visitors than a snap-shut single-open accordion. */
  allowMultiple?: boolean;
  defaultOpenIndexes?: number[];
};

/**
 * Keyboard-accessible accordion (the one genuinely interactive leaf `Prose`
 * needs). Follows the WAI-ARIA accordion pattern: a heading wraps a button
 * with `aria-expanded`/`aria-controls`, the panel is a `role="region"`
 * hidden via the native `hidden` attribute (never an animated height —
 * the contract forbids animating height, so we don't even attempt it).
 * Arrow keys / Home / End move focus between headers.
 */
export function Accordion({
  panels,
  className,
  allowMultiple = true,
  defaultOpenIndexes = [],
}: AccordionProps) {
  const [open, setOpen] = useState<Set<number>>(() => new Set(defaultOpenIndexes));
  const headerRefs = useRef<Array<HTMLButtonElement | null>>([]);

  function toggle(index: number) {
    setOpen((prev) => {
      const isOpen = prev.has(index);
      if (allowMultiple) {
        const next = new Set(prev);
        if (isOpen) next.delete(index);
        else next.add(index);
        return next;
      }
      return isOpen ? new Set() : new Set([index]);
    });
  }

  function focusHeader(index: number) {
    const count = headerRefs.current.length;
    const wrapped = ((index % count) + count) % count;
    headerRefs.current[wrapped]?.focus();
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        focusHeader(index + 1);
        break;
      case "ArrowUp":
        event.preventDefault();
        focusHeader(index - 1);
        break;
      case "Home":
        event.preventDefault();
        focusHeader(0);
        break;
      case "End":
        event.preventDefault();
        focusHeader(headerRefs.current.length - 1);
        break;
      default:
        break;
    }
  }

  return (
    <div className={cn("divide-y divide-cream-200 rounded-lg border border-cream-200 bg-cream-50", className)}>
      {panels.map((panel, index) => {
        const isOpen = open.has(index);
        const headerId = `${panel.id}-header`;
        const panelId = `${panel.id}-panel`;
        return (
          <div key={panel.id}>
            <h3 className="m-0">
              <button
                type="button"
                id={headerId}
                ref={(el) => {
                  headerRefs.current[index] = el;
                }}
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => toggle(index)}
                onKeyDown={(event) => onKeyDown(event, index)}
                className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-lg font-medium text-fairway-950 hover:bg-cream-100"
              >
                <span>{panel.title}</span>
                <ChevronDown
                  className={cn("h-5 w-5 shrink-0 text-fairway-700 transition-transform duration-200", isOpen && "rotate-180")}
                  aria-hidden="true"
                />
              </button>
            </h3>
            <div id={panelId} role="region" aria-labelledby={headerId} hidden={!isOpen} className="px-5 pb-5 pt-1">
              {panel.content}
            </div>
          </div>
        );
      })}
    </div>
  );
}
