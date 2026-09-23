import { cn } from "@/lib/cn";

type VegMarkProps = {
  className?: string;
  /** Visual size of the square mark. */
  size?: "sm" | "md";
};

/**
 * FSSAI-style vegetarian mark (green square + green dot).
 * Shown on storefront cards when `product.isEggless` is true.
 */
export function VegMark({ className, size = "sm" }: VegMarkProps) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center border-2 border-green-600 bg-white shadow-sm",
        size === "sm" ? "h-4 w-4" : "h-5 w-5",
        className,
      )}
      title="Vegetarian"
      aria-label="Vegetarian"
    >
      <span
        className={cn("rounded-full bg-green-600", size === "sm" ? "h-2 w-2" : "h-2.5 w-2.5")}
      />
    </span>
  );
}
