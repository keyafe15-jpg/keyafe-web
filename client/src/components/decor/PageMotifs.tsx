import type { ComponentType, SVGProps } from "react";
import { Cookie, Cupcake, Whisk } from "./motifs";

type Motif = ComponentType<SVGProps<SVGSVGElement>>;

// Fixed positions so the layout is intentional, not truly random.
// x/y are percentages of the parent container.
type Placement = {
  Motif: Motif;
  x: string;
  y: string;
  size: number;
  rotate: number;
  color: "brand" | "ink";
  opacity: number;
  hideOnMobile?: boolean;
};

const placements: Placement[] = [
  {
    Motif: Cupcake,
    x: "3%",
    y: "2%",
    size: 104,
    rotate: -14,
    color: "brand",
    opacity: 0.22,
  },
  {
    Motif: Whisk,
    x: "88%",
    y: "4%",
    size: 98,
    rotate: 16,
    color: "brand",
    opacity: 0.2,
  },
  {
    Motif: Cookie,
    x: "48%",
    y: "6%",
    size: 56,
    rotate: -8,
    color: "ink",
    opacity: 0.14,
    hideOnMobile: true,
  },

  {
    Motif: Whisk,
    x: "12%",
    y: "18%",
    size: 64,
    rotate: 20,
    color: "ink",
    opacity: 0.16,
    hideOnMobile: true,
  },
  {
    Motif: Cupcake,
    x: "78%",
    y: "22%",
    size: 70,
    rotate: -6,
    color: "brand",
    opacity: 0.22,
  },
  {
    Motif: Cookie,
    x: "36%",
    y: "28%",
    size: 60,
    rotate: 12,
    color: "brand",
    opacity: 0.2,
    hideOnMobile: true,
  },

  {
    Motif: Cupcake,
    x: "4%",
    y: "40%",
    size: 72,
    rotate: 8,
    color: "brand",
    opacity: 0.22,
  },
  {
    Motif: Cookie,
    x: "92%",
    y: "42%",
    size: 64,
    rotate: -14,
    color: "brand",
    opacity: 0.2,
  },
  {
    Motif: Whisk,
    x: "24%",
    y: "48%",
    size: 68,
    rotate: -18,
    color: "brand",
    opacity: 0.2,
    hideOnMobile: true,
  },
  {
    Motif: Cupcake,
    x: "60%",
    y: "52%",
    size: 60,
    rotate: 22,
    color: "ink",
    opacity: 0.14,
    hideOnMobile: true,
  },

  {
    Motif: Cookie,
    x: "8%",
    y: "64%",
    size: 72,
    rotate: 10,
    color: "brand",
    opacity: 0.22,
  },
  {
    Motif: Whisk,
    x: "72%",
    y: "66%",
    size: 72,
    rotate: -12,
    color: "brand",
    opacity: 0.2,
  },
  {
    Motif: Cupcake,
    x: "40%",
    y: "72%",
    size: 56,
    rotate: 4,
    color: "ink",
    opacity: 0.14,
    hideOnMobile: true,
  },

  {
    Motif: Cookie,
    x: "88%",
    y: "84%",
    size: 64,
    rotate: 16,
    color: "brand",
    opacity: 0.22,
  },
  {
    Motif: Cupcake,
    x: "16%",
    y: "88%",
    size: 72,
    rotate: -10,
    color: "brand",
    opacity: 0.22,
  },
  {
    Motif: Whisk,
    x: "54%",
    y: "92%",
    size: 64,
    rotate: 14,
    color: "ink",
    opacity: 0.16,
    hideOnMobile: true,
  },

  // Smaller "confetti" motifs mixed in between the larger ones.
  {
    Motif: Cookie,
    x: "22%",
    y: "7%",
    size: 28,
    rotate: 22,
    color: "brand",
    opacity: 0.18,
  },
  {
    Motif: Cupcake,
    x: "62%",
    y: "10%",
    size: 32,
    rotate: -18,
    color: "brand",
    opacity: 0.18,
    hideOnMobile: true,
  },
  {
    Motif: Whisk,
    x: "42%",
    y: "14%",
    size: 30,
    rotate: 30,
    color: "ink",
    opacity: 0.14,
    hideOnMobile: true,
  },
  {
    Motif: Cookie,
    x: "68%",
    y: "16%",
    size: 26,
    rotate: -10,
    color: "brand",
    opacity: 0.2,
  },

  {
    Motif: Cupcake,
    x: "30%",
    y: "24%",
    size: 34,
    rotate: 14,
    color: "brand",
    opacity: 0.18,
    hideOnMobile: true,
  },
  {
    Motif: Whisk,
    x: "56%",
    y: "32%",
    size: 30,
    rotate: -22,
    color: "brand",
    opacity: 0.18,
  },
  {
    Motif: Cookie,
    x: "14%",
    y: "34%",
    size: 28,
    rotate: 10,
    color: "ink",
    opacity: 0.14,
    hideOnMobile: true,
  },

  {
    Motif: Cupcake,
    x: "82%",
    y: "36%",
    size: 32,
    rotate: -26,
    color: "brand",
    opacity: 0.18,
    hideOnMobile: true,
  },
  {
    Motif: Cookie,
    x: "48%",
    y: "44%",
    size: 26,
    rotate: 18,
    color: "brand",
    opacity: 0.2,
  },
  {
    Motif: Whisk,
    x: "68%",
    y: "58%",
    size: 30,
    rotate: -6,
    color: "ink",
    opacity: 0.14,
    hideOnMobile: true,
  },

  {
    Motif: Cookie,
    x: "34%",
    y: "62%",
    size: 28,
    rotate: 24,
    color: "brand",
    opacity: 0.18,
  },
  {
    Motif: Cupcake,
    x: "84%",
    y: "70%",
    size: 32,
    rotate: 10,
    color: "brand",
    opacity: 0.18,
    hideOnMobile: true,
  },
  {
    Motif: Whisk,
    x: "6%",
    y: "76%",
    size: 30,
    rotate: -20,
    color: "brand",
    opacity: 0.18,
  },
  {
    Motif: Cookie,
    x: "58%",
    y: "80%",
    size: 26,
    rotate: 14,
    color: "ink",
    opacity: 0.14,
    hideOnMobile: true,
  },

  {
    Motif: Cupcake,
    x: "30%",
    y: "94%",
    size: 32,
    rotate: -12,
    color: "brand",
    opacity: 0.18,
  },
  {
    Motif: Cookie,
    x: "76%",
    y: "96%",
    size: 28,
    rotate: 20,
    color: "brand",
    opacity: 0.2,
    hideOnMobile: true,
  },

  // Extra scattered motifs to make the page feel richly decorated.
  {
    Motif: Cupcake,
    x: "18%",
    y: "12%",
    size: 46,
    rotate: 18,
    color: "brand",
    opacity: 0.32,
  },
  {
    Motif: Cookie,
    x: "72%",
    y: "12%",
    size: 42,
    rotate: -16,
    color: "ink",
    opacity: 0.26,
  },
  {
    Motif: Whisk,
    x: "52%",
    y: "18%",
    size: 40,
    rotate: 26,
    color: "brand",
    opacity: 0.28,
  },
  {
    Motif: Cupcake,
    x: "26%",
    y: "54%",
    size: 44,
    rotate: -12,
    color: "brand",
    opacity: 0.3,
  },
  {
    Motif: Cookie,
    x: "62%",
    y: "58%",
    size: 40,
    rotate: 12,
    color: "ink",
    opacity: 0.24,
  },
  {
    Motif: Whisk,
    x: "84%",
    y: "56%",
    size: 38,
    rotate: -18,
    color: "brand",
    opacity: 0.28,
  },
  {
    Motif: Cupcake,
    x: "44%",
    y: "72%",
    size: 42,
    rotate: 20,
    color: "brand",
    opacity: 0.3,
  },
  {
    Motif: Cookie,
    x: "10%",
    y: "72%",
    size: 38,
    rotate: -14,
    color: "brand",
    opacity: 0.28,
  },
  {
    Motif: Whisk,
    x: "90%",
    y: "78%",
    size: 40,
    rotate: 12,
    color: "ink",
    opacity: 0.24,
  },
  {
    Motif: Cookie,
    x: "32%",
    y: "86%",
    size: 36,
    rotate: 18,
    color: "brand",
    opacity: 0.28,
  },
  {
    Motif: Cupcake,
    x: "60%",
    y: "92%",
    size: 40,
    rotate: -10,
    color: "brand",
    opacity: 0.32,
  },
  {
    Motif: Whisk,
    x: "74%",
    y: "38%",
    size: 36,
    rotate: 16,
    color: "ink",
    opacity: 0.22,
  },

  // Bigger, bolder motifs concentrated near the end of the page (quote
  // banner / footer area) so the closing section doesn't feel bare.
  {
    Motif: Cupcake,
    x: "6%",
    y: "82%",
    size: 96,
    rotate: -16,
    color: "brand",
    opacity: 0.3,
    hideOnMobile: true,
  },
  {
    Motif: Whisk,
    x: "86%",
    y: "84%",
    size: 92,
    rotate: 20,
    color: "brand",
    opacity: 0.28,
    hideOnMobile: true,
  },
  {
    Motif: Cookie,
    x: "46%",
    y: "80%",
    size: 70,
    rotate: 12,
    color: "ink",
    opacity: 0.22,
  },
  {
    Motif: Cupcake,
    x: "22%",
    y: "97%",
    size: 60,
    rotate: 8,
    color: "brand",
    opacity: 0.3,
  },
  {
    Motif: Cookie,
    x: "70%",
    y: "98%",
    size: 56,
    rotate: -14,
    color: "brand",
    opacity: 0.3,
  },
  {
    Motif: Whisk,
    x: "94%",
    y: "94%",
    size: 50,
    rotate: -8,
    color: "ink",
    opacity: 0.24,
    hideOnMobile: true,
  },
  {
    Motif: Cupcake,
    x: "38%",
    y: "88%",
    size: 44,
    rotate: -20,
    color: "brand",
    opacity: 0.26,
  },

  // A few extra oversized motifs scattered through the middle for stronger
  // overall presence.
  {
    Motif: Whisk,
    x: "2%",
    y: "56%",
    size: 88,
    rotate: 10,
    color: "brand",
    opacity: 0.26,
    hideOnMobile: true,
  },
  {
    Motif: Cupcake,
    x: "94%",
    y: "62%",
    size: 84,
    rotate: -22,
    color: "brand",
    opacity: 0.26,
    hideOnMobile: true,
  },
  {
    Motif: Cookie,
    x: "50%",
    y: "34%",
    size: 78,
    rotate: 16,
    color: "ink",
    opacity: 0.2,
    hideOnMobile: true,
  },
];

export function PageMotifs() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
    >
      {placements.map(
        ({ Motif, x, y, size, rotate, color, opacity, hideOnMobile }, i) => {
          // Stagger duration (5.5–8s) and delay (0–3.5s) so bobs are out of sync.
          const duration = 5.5 + ((i * 0.37) % 2.5);
          const delay = (i * 0.31) % 3.5;
          // Boost visibility across the board; only suppress the very largest
          // shapes on mobile so small screens don't feel cluttered.
          const boostedOpacity = Math.min(opacity * 1.7, 0.85);
          const suppressOnMobile = hideOnMobile && size >= 60;
          return (
            <Motif
              key={i}
              data-motif=""
              {...(size >= 50 ? { "data-lg": "" } : {})}
              className={[
                "absolute",
                color === "brand" ? "text-brand-500" : "text-ink-500",
                suppressOnMobile ? "hidden sm:block" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              style={{
                left: x,
                top: y,
                width: size,
                height: size,
                opacity: boostedOpacity,
                transform: `rotate(${rotate}deg)`,
                animation: `motif-float ${duration.toFixed(2)}s ease-in-out ${delay.toFixed(2)}s infinite`,
                willChange: "translate",
              }}
            />
          );
        },
      )}
    </div>
  );
}
