import type { ReactNode } from "react";
import { cx } from "./cx";
import { discountPercent, formatINR } from "./priceMath";

const SIZE_CLASS = {
  xs: "text-xs",
  sm: "text-sm",
  md: "text-base",
  lg: "text-lg",
  xl: "text-2xl",
} as const;

export interface PriceProps {
  /** What the customer pays. */
  amount: number | string;
  /** Pre-discount price; struck through only when higher than `amount`. */
  original?: number | string | null;
  /** Inherits the parent's font size when omitted. */
  size?: keyof typeof SIZE_CLASS;
  prefix?: ReactNode;
  showBadge?: boolean;
  className?: string;
}

/** Product price: payable amount, with the original struck through when discounted. */
export function Price({ amount, original, size, prefix, showBadge, className }: PriceProps) {
  const now = Math.round(Number(amount));
  const was = original != null ? Math.round(Number(original)) : null;
  const pct = discountPercent(now, was);

  return (
    <span
      className={cx(
        "inline-flex flex-wrap items-baseline gap-x-1.5",
        size && SIZE_CLASS[size],
        className,
      )}
    >
      {prefix && <span className="text-[0.8em] font-normal opacity-75">{prefix}</span>}
      <span className="font-semibold">{formatINR(now)}</span>
      {pct > 0 && was != null && (
        <>
          <span className="sr-only">, was</span>
          <s className="text-[0.8em] font-normal opacity-60">{formatINR(was)}</s>
          {showBadge && (
            <span className="self-center rounded bg-emerald-100 px-1 py-px text-[0.7em] leading-tight font-semibold text-emerald-700">
              {pct}% off
            </span>
          )}
        </>
      )}
    </span>
  );
}
