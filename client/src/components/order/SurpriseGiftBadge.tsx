import { Gift } from "lucide-react";
import { cn } from "@/lib/cn";

type Props = {
  className?: string;
  /** Compact for list rows; default includes helper copy. */
  compact?: boolean;
};

export function SurpriseGiftBadge({ className, compact = false }: Props) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md bg-violet-50 px-2 py-0.5 text-[11px] font-medium text-violet-800 ring-1 ring-violet-200/80",
        className,
      )}
      title="Surprise gift — we’ll only message you, not the recipient"
    >
      <Gift className="h-3 w-3 shrink-0" aria-hidden />
      {compact ? "Surprise" : "Surprise gift — we’ll only message you, not the recipient"}
    </span>
  );
}
