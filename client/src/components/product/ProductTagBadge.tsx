import { cn } from "@/lib/cn";

export interface ProductTag {
  id: string;
  slug: string;
  name: string;
  colorHex: string | null;
}

const DEFAULT_BG = "#F5F0E8";
const DEFAULT_FG = "#3D3429";

// Horizontal luggage-tag silhouette: scalloped left end + punch hole.
const TAG_PATH = `
  M 20 1
  L 94 1
  Q 99 1 99 5.5
  L 99 18.5
  Q 99 23 94 23
  L 20 23
  C 12.5 23 8.5 21.5 6.5 19.5
  C 2.5 16.5 0.5 14.5 0.5 12
  C 0.5 9.5 2.5 7.5 6.5 4.5
  C 8.5 2.5 12.5 1 20 1
  Z
  M 7 12
  m -2.25 0 a 2.25 2.25 0 1 0 4.5 0 a 2.25 2.25 0 1 0 -4.5 0
`;

function textColorForBackground(hex: string): string {
  const clean = hex.replace("#", "");
  if (!/^[0-9A-Fa-f]{6}$/.test(clean)) return DEFAULT_FG;

  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  return luminance > 0.62 ? "#1C1917" : "#FFFFFF";
}

function tagColors(colorHex: string | null) {
  const bg = colorHex ?? DEFAULT_BG;
  const color = colorHex ? textColorForBackground(colorHex) : DEFAULT_FG;
  return { bg, color };
}

interface ProductTagBadgeProps {
  tag: ProductTag;
  className?: string;
  size?: "sm" | "md";
}

export function ProductTagBadge({
  tag,
  className,
  size = "sm",
}: ProductTagBadgeProps) {
  const { bg, color } = tagColors(tag.colorHex);
  const height = size === "sm" ? 22 : 28;
  const padLeft = size === "sm" ? 15 : 19;
  const padRight = size === "sm" ? 7 : 10;

  return (
    <span
      className={cn(
        "relative inline-flex items-center drop-shadow-[0_1px_3px_rgba(0,0,0,0.18)]",
        className,
      )}
      style={{ height, minWidth: size === "sm" ? 44 : 52 }}
    >
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 100 24"
        preserveAspectRatio="none"
        aria-hidden
      >
        <path fill={bg} fillRule="evenodd" d={TAG_PATH} />
        <circle
          cx="7"
          cy="12"
          r="2.25"
          fill="none"
          stroke="rgba(0,0,0,0.12)"
          strokeWidth="0.6"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <span
        className={cn(
          "relative z-10 font-semibold leading-none whitespace-nowrap",
          size === "sm" ? "text-[9px] sm:text-[10px]" : "text-[10px] sm:text-xs",
        )}
        style={{
          color,
          paddingLeft: padLeft,
          paddingRight: padRight,
        }}
      >
        {tag.name}
      </span>
    </span>
  );
}

interface ProductCardTagsProps {
  tags: ProductTag[];
  max?: number;
  className?: string;
  size?: "sm" | "md";
}

export function ProductCardTags({
  tags,
  max = 2,
  className,
  size = "sm",
}: ProductCardTagsProps) {
  if (tags.length === 0) return null;
  return (
    <div className={className ?? "flex flex-wrap gap-1.5"}>
      {tags.slice(0, max).map((tag) => (
        <ProductTagBadge key={tag.id} tag={tag} size={size} />
      ))}
    </div>
  );
}
