import { useState } from "react";
import { ImagePlus, Sparkles, X } from "lucide-react";
import { Field, inputClass } from "@/components/form/Field";
import { cn } from "@/lib/cn";
import { useParseReceipt, type ReceiptDraft, type ReceiptParseKind } from "@/hooks/useAdminBooks";

export function ScanBillBlock({
  kind,
  disabled,
  onDraft,
}: {
  kind: ReceiptParseKind;
  disabled?: boolean;
  onDraft: (draft: ReceiptDraft) => void;
}) {
  const parse = useParseReceipt();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [context, setContext] = useState("");
  const [error, setError] = useState<string | null>(null);

  const pick = (next: File | null) => {
    if (preview) URL.revokeObjectURL(preview);
    if (next && /heic|heif/i.test(next.type || next.name)) {
      setFile(null);
      setPreview(null);
      setError("HEIC is not supported. Use a JPEG, PNG, WebP, or a screenshot.");
      return;
    }
    setFile(next);
    setPreview(next ? URL.createObjectURL(next) : null);
    setError(null);
  };

  return (
    <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/70 p-3">
      <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">Scan bill</p>
      <p className="mt-0.5 text-xs text-slate-500">
        Typed invoice or handwritten slip. Close and well lit. JPEG, PNG, or screenshot — not stored.
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {preview ? (
          <div className="relative">
            <img
              src={preview}
              alt="Bill preview"
              className="h-14 w-14 rounded border border-slate-200 object-cover"
            />
            <button
              type="button"
              onClick={() => pick(null)}
              className="absolute -top-1.5 -right-1.5 rounded-full bg-white p-0.5 text-slate-500 shadow ring-1 ring-slate-200 hover:text-red-600"
              aria-label="Remove photo"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ) : (
          <label className="flex h-14 w-14 cursor-pointer items-center justify-center rounded border border-dashed border-slate-300 text-slate-400 hover:border-brand-500 hover:text-brand-600">
            <ImagePlus className="h-5 w-5" />
            <span className="sr-only">Add bill photo</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/*"
              capture="environment"
              disabled={disabled}
              onChange={(e) => {
                const next = e.target.files?.[0] ?? null;
                e.target.value = "";
                pick(next);
              }}
              className="sr-only"
            />
          </label>
        )}
        <Field label="Context" className="min-w-0 flex-1" hint="Optional — anything the photo misses.">
          <input
            value={context}
            onChange={(e) => setContext(e.target.value)}
            placeholder="e.g. the 2kg bag is cream"
            className={cn(inputClass, "h-9")}
            disabled={disabled}
            maxLength={400}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.preventDefault();
            }}
          />
        </Field>
        <button
          type="button"
          disabled={disabled || !file || parse.isPending}
          onClick={() => {
            if (!file) return;
            setError(null);
            parse.mutate(
              { kind, image: file, context },
              {
                onSuccess: onDraft,
                onError: (err) =>
                  setError(err instanceof Error ? err.message : "Could not read that bill"),
              },
            );
          }}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          <Sparkles className="h-4 w-4" />
          {parse.isPending ? "Reading…" : "Read bill"}
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
    </div>
  );
}
