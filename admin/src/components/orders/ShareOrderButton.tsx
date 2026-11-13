import { useState } from "react";
import { Check, Copy, Share2 } from "lucide-react";
import {
  copyShareText,
  formatOrderShareText,
  shareOrder,
  type ShareableOrder,
} from "@/lib/shareOrder";
import { cn } from "@/lib/cn";

export function ShareOrderButton({
  order,
  className,
}: {
  order: ShareableOrder;
  className?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [slip, setSlip] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const markCopied = () => {
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className={cn("flex max-w-[20rem] flex-col items-end gap-1.5", className)}>
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          const text = formatOrderShareText(order);
          setBusy(true);
          setError(null);
          if (text) setSlip(text);
          void shareOrder(order)
            .then((result) => {
              if (result === "copied") markCopied();
            })
            .catch((err) => {
              setError(err instanceof Error ? err.message : "Could not share this order");
            })
            .finally(() => setBusy(false));
        }}
        className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-brand-500 hover:text-brand-700 disabled:opacity-50"
      >
        {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Share2 className="h-3.5 w-3.5" />}
        {busy ? "Sharing…" : copied ? "Text copied — paste in chat" : "Share"}
      </button>
      {error && <p className="text-right text-[11px] text-red-700">{error}</p>}
      {slip && (
        <div className="w-full rounded-md border border-slate-200 bg-white p-2 text-left shadow-sm">
          <pre className="max-h-40 overflow-auto text-[11px] leading-snug whitespace-pre-wrap text-slate-800">
            {slip}
          </pre>
          <button
            type="button"
            onClick={() => {
              void copyShareText(slip).then((ok) => {
                if (ok) markCopied();
                else setError("Could not copy. Select the text above and copy.");
              });
            }}
            className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-brand-700 hover:text-brand-500"
          >
            <Copy className="h-3 w-3" />
            Copy details
          </button>
        </div>
      )}
    </div>
  );
}
