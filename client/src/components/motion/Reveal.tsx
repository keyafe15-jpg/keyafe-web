import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

type RevealProps = {
  children: ReactNode;
  /** Stagger delay in ms, applied via transition-delay. */
  delay?: number;
  className?: string;
  /** Entrance direction. Default: up. */
  from?: "up" | "left" | "right" | "scale";
};

/**
 * Fades content into place the first time it scrolls into view.
 * Respects prefers-reduced-motion by rendering content visible immediately.
 */
export function Reveal({
  children,
  delay = 0,
  className = "",
  from = "up",
}: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -40px 0px" },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={cn(
        "reveal",
        from === "left" && "reveal-from-left",
        from === "right" && "reveal-from-right",
        from === "scale" && "reveal-from-scale",
        visible && "reveal-visible",
        className,
      )}
      style={{ transitionDelay: visible ? `${delay}ms` : "0ms" }}
    >
      {children}
    </div>
  );
}
