import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type EmptyStateProps = {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
};

/** Friendly placeholder for empty lists/searches (no results, no upcoming events, …). */
export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 rounded-lg border border-dashed border-cream-200 bg-cream-100/60 px-6 py-16 text-center",
        className
      )}
    >
      {icon ? (
        <span aria-hidden="true" className="text-fairway-700">
          {icon}
        </span>
      ) : null}
      <h3 className="text-xl text-fairway-950">{title}</h3>
      {description ? <p className="max-w-md text-ink-500">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
