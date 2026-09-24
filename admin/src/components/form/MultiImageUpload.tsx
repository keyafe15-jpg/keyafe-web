import { useEffect, useId, useRef, useState } from "react";
import { X, Upload } from "lucide-react";
import { cn } from "@/lib/cn";

const MAX_BYTES = 12 * 1024 * 1024;
const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function MultiImageUpload({
  value,
  onChange,
  max = 5,
  compact = false,
}: {
  value: File[];
  onChange: (files: File[]) => void;
  max?: number;
  /** Smaller dropzone for dense forms (e.g. bulk quick-add). */
  compact?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const [previews, setPreviews] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const urls = value.map((f) => URL.createObjectURL(f));
    setPreviews(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [value]);

  const canAddMore = value.length < max;

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setError(null);

    const nextErrors: string[] = [];
    const nextFiles: File[] = [];
    const slotsLeft = max - value.length;

    Array.from(files)
      .slice(0, slotsLeft)
      .forEach((f) => {
        if (!ACCEPTED.includes(f.type)) {
          nextErrors.push(`${f.name}: unsupported type`);
          return;
        }
        if (f.size > MAX_BYTES) {
          nextErrors.push(`${f.name}: too large (${formatSize(f.size)})`);
          return;
        }
        nextFiles.push(f);
      });

    if (files.length > slotsLeft) {
      nextErrors.push(`Only ${slotsLeft} more image(s) allowed (max ${max}).`);
    }
    if (nextErrors.length) setError(nextErrors.join(" · "));

    if (nextFiles.length) onChange([...value, ...nextFiles]);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={ACCEPTED.join(",")}
        multiple
        className="sr-only"
        onChange={(e) => handleFiles(e.target.files)}
      />

      {value.length === 0 ? (
        <label
          htmlFor={inputId}
          className={cn(
            "flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 bg-slate-50/60 text-center transition hover:border-brand-500 hover:bg-slate-50",
            compact
              ? "flex-row px-3 py-3"
              : "flex-col gap-1 px-4 py-8",
          )}
        >
          <Upload className={cn("text-slate-400", compact ? "h-4 w-4 shrink-0" : "h-6 w-6")} />
          <span className={compact ? "text-left" : undefined}>
            <span
              className={cn(
                "font-medium text-slate-700",
                compact ? "text-xs" : "block text-sm",
              )}
            >
              {compact ? "Add photos" : "Upload product photos"}
            </span>
            <span className={cn("text-slate-500", compact ? "ml-1.5 text-[10px]" : "block text-xs")}>
              Up to {max} · JPG / PNG / WEBP · 12 MB each
            </span>
          </span>
        </label>
      ) : (
        <div
          className={cn(
            "grid gap-3",
            compact ? "grid-cols-3 sm:grid-cols-4 lg:grid-cols-6" : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5",
          )}
        >
          {value.map((file, idx) => (
            <div
              key={`${file.name}-${idx}`}
              className="group relative overflow-hidden rounded-lg border border-slate-200 bg-white"
            >
              <img
                src={previews[idx]}
                alt={`Photo ${idx + 1}`}
                className="aspect-square w-full object-cover"
              />
              <button
                type="button"
                onClick={() => onChange(value.filter((_, i) => i !== idx))}
                className="absolute top-1 right-1 flex h-6 w-6 items-center justify-center rounded-full bg-slate-900/70 text-white opacity-0 transition group-hover:opacity-100"
                aria-label="Remove"
              >
                <X className="h-3 w-3" />
              </button>
              <div className="border-t border-slate-100 px-2 py-1">
                <p className="truncate text-[11px] text-slate-700">{file.name}</p>
                <p className="text-[10px] text-slate-500">{formatSize(file.size)}</p>
              </div>
            </div>
          ))}
          {canAddMore && (
            <label
              htmlFor={inputId}
              className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-slate-300 bg-slate-50/60 text-center transition hover:border-brand-500 hover:bg-slate-50"
            >
              <Upload className="h-5 w-5 text-slate-400" />
              <span className="text-xs font-medium text-slate-700">Add more</span>
              <span className="text-[10px] text-slate-500">
                {value.length}/{max}
              </span>
            </label>
          )}
        </div>
      )}

      {error && <p className="mt-2 text-xs text-brand-500">{error}</p>}
    </div>
  );
}
