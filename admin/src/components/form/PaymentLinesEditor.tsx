import { useEffect, useState } from "react";
import { ImagePlus, Plus, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { inputClass } from "@/components/form/Field";
import { OFFLINE_PAYMENT_METHODS, type OfflinePaymentMethod } from "@/pages/orders/order-ui";
import { MAX_ORDER_PAYMENTS } from "@/hooks/useAdminOrders";

export type PaymentLineDraft = {
  key: string;
  method: OfflinePaymentMethod;
  amount: string;
  screenshotFile?: File | null;
  screenshotUrl?: string | null;
};

export function emptyPaymentLine(method: OfflinePaymentMethod = "upi"): PaymentLineDraft {
  return {
    key: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    method,
    amount: "",
    screenshotFile: null,
    screenshotUrl: null,
  };
}

export function paymentLinesSum(lines: PaymentLineDraft[]): number {
  return lines.reduce((sum, line) => sum + (Number(line.amount) || 0), 0);
}

function useObjectUrl(file: File | null | undefined) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!file) {
      setUrl(null);
      return;
    }
    const next = URL.createObjectURL(file);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file]);
  return url;
}

function LineScreenshot({
  line,
  onChange,
  disabled,
}: {
  line: PaymentLineDraft;
  onChange: (patch: Partial<PaymentLineDraft>) => void;
  disabled?: boolean;
}) {
  const preview = useObjectUrl(line.screenshotFile) ?? line.screenshotUrl ?? null;
  return (
    <div className="flex items-center gap-1.5">
      {preview ? (
        <div className="relative">
          <img
            src={preview}
            alt={`${line.method} payment proof`}
            className="h-10 w-10 rounded-md border border-slate-200 object-cover"
          />
          {!disabled && (
            <button
              type="button"
              onClick={() => onChange({ screenshotFile: null, screenshotUrl: null })}
              className="absolute -top-1.5 -right-1.5 rounded-full bg-white p-0.5 text-slate-500 shadow ring-1 ring-slate-200 hover:text-red-600"
              aria-label="Remove screenshot"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      ) : (
        <label
          className={cn(
            "flex h-10 w-10 cursor-pointer items-center justify-center rounded-md border border-dashed border-slate-300 text-slate-400 hover:border-brand-500 hover:text-brand-600",
            disabled && "pointer-events-none opacity-50",
          )}
        >
          <ImagePlus className="h-4 w-4" />
          <span className="sr-only">Add payment screenshot</span>
          <input
            type="file"
            accept="image/*"
            disabled={disabled}
            onChange={(e) => {
              const file = e.target.files?.[0] ?? null;
              e.target.value = "";
              if (file) onChange({ screenshotFile: file });
            }}
            className="sr-only"
          />
        </label>
      )}
    </div>
  );
}

export function PaymentLinesEditor({
  lines,
  onChange,
  disabled,
  max = MAX_ORDER_PAYMENTS,
}: {
  lines: PaymentLineDraft[];
  onChange: (lines: PaymentLineDraft[]) => void;
  disabled?: boolean;
  max?: number;
}) {
  const patch = (key: string, next: Partial<PaymentLineDraft>) =>
    onChange(lines.map((line) => (line.key === key ? { ...line, ...next } : line)));

  return (
    <div className="space-y-2">
      {lines.map((line, index) => (
        <div
          key={line.key}
          className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50/70 p-2"
        >
          <div className="flex flex-wrap gap-1">
            {OFFLINE_PAYMENT_METHODS.map((m) => (
              <button
                key={m.value}
                type="button"
                aria-pressed={line.method === m.value}
                disabled={disabled}
                onClick={() => patch(line.key, { method: m.value })}
                className={cn(
                  "rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition disabled:opacity-50",
                  line.method === m.value
                    ? "border-brand-500 bg-brand-500 text-white"
                    : "hover:border-brand-300 border-slate-200 bg-white text-slate-700",
                )}
              >
                {m.label}
              </button>
            ))}
          </div>
          <div className="relative w-28">
            <span className="pointer-events-none absolute top-1/2 left-2 -translate-y-1/2 text-xs text-slate-400">
              ₹
            </span>
            <input
              inputMode="decimal"
              value={line.amount}
              disabled={disabled}
              onChange={(e) => patch(line.key, { amount: e.target.value.replace(/[^0-9.]/g, "") })}
              placeholder="0"
              className={cn(inputClass, "h-8 py-1 pr-2 pl-5 text-sm")}
            />
          </div>
          <LineScreenshot
            line={line}
            disabled={disabled}
            onChange={(next) => patch(line.key, next)}
          />
          {lines.length > 1 && (
            <button
              type="button"
              disabled={disabled}
              onClick={() => onChange(lines.filter((l) => l.key !== line.key))}
              className="ml-auto rounded-full p-1 text-slate-400 hover:text-red-600 disabled:opacity-50"
              aria-label={`Remove payment line ${index + 1}`}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      ))}
      {lines.length < max && (
        <button
          type="button"
          disabled={disabled}
          onClick={() =>
            onChange([...lines, emptyPaymentLine(lines.at(-1)?.method ?? "cash")])
          }
          className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:text-brand-800 disabled:opacity-50"
        >
          <Plus className="h-3.5 w-3.5" />
          Add another payment
        </button>
      )}
    </div>
  );
}
