import Link from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "gold";
export type ButtonSize = "sm" | "md" | "lg";

type CommonProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  children: ReactNode;
  /** Renders a leading icon (e.g. a lucide-react icon element). */
  icon?: ReactNode;
  iconPosition?: "left" | "right";
};

type ButtonAsButton = CommonProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children"> & {
    href?: undefined;
  };

type ButtonAsAnchor = CommonProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "className" | "children"> & {
    href: string;
  };

export type ButtonProps = ButtonAsButton | ButtonAsAnchor;

const base =
  "inline-flex items-center justify-center gap-2 rounded-md font-medium " +
  "transition-[background-color,color,box-shadow,transform] duration-150 " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 " +
  "disabled:pointer-events-none disabled:opacity-50 active:translate-y-px";

const sizes: Record<ButtonSize, string> = {
  // Every size keeps a >=44px touch target for older visitors.
  sm: "h-11 px-4 text-sm",
  md: "h-12 px-6 text-base",
  lg: "h-14 px-8 text-lg",
};

const variants: Record<ButtonVariant, string> = {
  primary: "bg-fairway-900 text-cream-50 hover:bg-fairway-700 shadow-soft",
  secondary:
    "bg-cream-50 text-fairway-950 border border-fairway-900/20 hover:bg-cream-100",
  ghost: "bg-transparent text-fairway-900 hover:bg-fairway-100",
  // gold-500 fails AA for text on cream; here it is only ever a *background*
  // with dark ink/fairway text on top, which passes comfortably (~7.5:1).
  gold: "bg-gold-500 text-fairway-950 hover:bg-gold-300 shadow-soft",
};

/** Heritage-club CTA button. Renders an <a> when given `href`, otherwise a <button>. */
export function Button(props: ButtonProps) {
  const {
    variant = "primary",
    size = "md",
    className,
    children,
    icon,
    iconPosition = "left",
    ...rest
  } = props;

  const classes = cn(base, sizes[size], variants[variant], className);
  const content = (
    <>
      {icon && iconPosition === "left" ? <span aria-hidden="true">{icon}</span> : null}
      <span>{children}</span>
      {icon && iconPosition === "right" ? <span aria-hidden="true">{icon}</span> : null}
    </>
  );

  if ("href" in props && props.href) {
    const { href, ...anchorRest } = rest as Omit<ButtonAsAnchor, keyof CommonProps>;
    const isExternal = /^https?:\/\//i.test(href);
    return (
      <Link
        href={href}
        className={classes}
        {...(isExternal ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        {...anchorRest}
      >
        {content}
      </Link>
    );
  }

  const buttonRest = rest as Omit<ButtonAsButton, keyof CommonProps>;
  return (
    <button className={classes} {...buttonRest}>
      {content}
    </button>
  );
}
