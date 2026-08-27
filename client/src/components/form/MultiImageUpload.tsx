import { useEffect, useId, useRef, useState } from "react";

const MAX_BYTES = 12 * 1024 * 1024; // 12 MB per image
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
  max = 4,
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
          nextErrors.push(`${f.name}: unsupported file type`);
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

  const removeAt = (idx: number) => {
    onChange(value.filter((_, i) => i !== idx));
    setError(null);
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
          className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-cream-200 bg-cream-50/60 px-4 py-6 text-center transition hover:border-brand-300 hover:bg-cream-50"
        >
          <UploadIcon />
          <span className="text-sm font-medium text-ink-700">
            Add reference images
          </span>
          <span className="text-xs text-ink-500">
            Up to {max} · JPG, PNG, WEBP or HEIC · 12 MB each
          </span>
        </label>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {value.map((file, idx) => (
            <div
              key={`${file.name}-${idx}`}
              className="group relative overflow-hidden rounded-lg border border-cream-200 bg-white"
            >
              <img
                src={previews[idx]}
                alt={`Reference ${idx + 1}`}
                className="aspect-square w-full object-cover"
              />
              <button
                type="button"
                onClick={() => removeAt(idx)}
                className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-ink-900/70 text-white opacity-0 transition group-hover:opacity-100 focus:opacity-100"
                aria-label={`Remove ${file.name}`}
              >
                <svg
                  width={12}
                  height={12}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={3}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
              <div className="border-t border-cream-100 px-2 py-1">
                <p className="truncate text-[11px] text-ink-700">{file.name}</p>
                <p className="text-[10px] text-ink-500">
                  {formatSize(file.size)}
                </p>
              </div>
            </div>
          ))}

          {canAddMore && (
            <label
              htmlFor={inputId}
              className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-cream-200 bg-cream-50/60 text-center transition hover:border-brand-300 hover:bg-cream-50"
            >
              <UploadIcon />
              <span className="text-xs font-medium text-ink-700">Add more</span>
              <span className="text-[10px] text-ink-500">
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

function UploadIcon() {
  return (
    <svg
      width={24}
      height={24}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-ink-500"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}
