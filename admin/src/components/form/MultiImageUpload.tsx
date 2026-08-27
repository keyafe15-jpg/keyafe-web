import { useEffect, useId, useRef, useState } from "react";
import { X, Upload } from "lucide-react";

const MAX_BYTES = 12 * 1024 * 1024;
const ACCEPTED = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
];

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function MultiImageUpload({
  value,
  onChange,
  max = 5,
}: {
  value: File[];
  onChange: (files: File[]) => void;
  max?: number;
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
          className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-slate-300 bg-slate-50/60 px-4 py-8 text-center transition hover:border-brand-500 hover:bg-slate-50"
        >
          <Upload className="h-6 w-6 text-slate-400" />
          <span className="text-sm font-medium text-slate-700">
            Upload product photos
          </span>
          <span className="text-xs text-slate-500">
            Up to {max} · JPG / PNG / WEBP · 12 MB each
          </span>
        </label>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
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
                className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-slate-900/70 text-white opacity-0 transition group-hover:opacity-100"
                aria-label="Remove"
              >
                <X className="h-3 w-3" />
              </button>
              <div className="border-t border-slate-100 px-2 py-1">
                <p className="truncate text-[11px] text-slate-700">
                  {file.name}
                </p>
                <p className="text-[10px] text-slate-500">
                  {formatSize(file.size)}
                </p>
              </div>
            </div>
          ))}
          {canAddMore && (
            <label
              htmlFor={inputId}
              className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-slate-300 bg-slate-50/60 text-center transition hover:border-brand-500 hover:bg-slate-50"
            >
              <Upload className="h-5 w-5 text-slate-400" />
              <span className="text-xs font-medium text-slate-700">
                Add more
              </span>
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
