import { useEffect, useId, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Wraps an order button that can't be used yet. While `message` is set the
 * reason shows as a tooltip on hover (pointer devices) and briefly after a
 * tap, so empty forms stay quiet until the customer tries to continue.
 */
export function BlockedTooltip({
  message,
  align = "center",
  className,
  children,
}: {
  message: string | null;
  align?: "center" | "end";
  className?: string;
  children: ReactNode;
}) {
  const id = useId();
  const [flashed, setFlashed] = useState(false);

  useEffect(() => {
    if (!flashed) return;
    const t = setTimeout(() => setFlashed(false), 3500);
    return () => clearTimeout(t);
  }, [flashed]);

  return (
    <div
      className={cn("group relative", className)}
      aria-describedby={message ? id : undefined}
      onClickCapture={() => {
        if (message) setFlashed(true);
      }}
    >
      {children}
      {message && (
        <span
          id={id}
          role="tooltip"
          className={cn(
            "pointer-events-none absolute bottom-full z-40 mb-2 w-max max-w-[16rem] rounded-lg bg-ink-900 px-3 py-2 text-center text-xs leading-snug font-medium text-white shadow-lg transition-opacity duration-150",
            "after:absolute after:top-full after:border-4 after:border-transparent after:border-t-ink-900",
            align === "center"
              ? "left-1/2 -translate-x-1/2 after:left-1/2 after:-translate-x-1/2"
              : "right-0 after:right-6",
            flashed ? "opacity-100" : "opacity-0 [@media(hover:hover)]:group-hover:opacity-100",
          )}
        >
          {message}
        </span>
      )}
    </div>
  );
}
