import { useEffect, useId, useRef, useState } from "react";

const MAX_BYTES = 12 * 1024 * 1024; // 12 MB
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

export function ImageUpload({
  value,
  onChange,
  label = "Choose image",
}: {
  value: File | null;
  onChange: (file: File | null) => void;
  label?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!value) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(value);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [value]);

  const handleFile = (file: File | null) => {
    setError(null);
    if (!file) {
      onChange(null);
      return;
    }
    if (!ACCEPTED.includes(file.type)) {
      setError("Please upload a JPG, PNG, WEBP, or HEIC image.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError(`Image is too large (${formatSize(file.size)}). Max 12 MB.`);
      return;
    }
    onChange(file);
  };

  return (
    <div>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={ACCEPTED.join(",")}
        className="sr-only"
        onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
      />

      {value && preview ? (
        <div className="flex items-center gap-4 rounded-lg border border-cream-200 bg-white p-3">
          <img
            src={preview}
            alt="Reference preview"
            className="h-16 w-16 shrink-0 rounded-md object-cover"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-ink-900">{value.name}</p>
            <p className="text-xs text-ink-500">{formatSize(value.size)}</p>
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="rounded-full border border-cream-200 px-3 py-1 text-xs font-medium text-ink-700 transition hover:bg-cream-100"
            >
              Change
            </button>
            <button
              type="button"
              onClick={() => {
                handleFile(null);
                if (inputRef.current) inputRef.current.value = "";
              }}
              className="rounded-full px-3 py-1 text-xs font-medium text-brand-500 transition hover:bg-cream-100"
            >
              Remove
            </button>
          </div>
        </div>
      ) : (
        <label
          htmlFor={inputId}
          className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-cream-200 bg-cream-50/60 px-4 py-6 text-center transition hover:border-brand-300 hover:bg-cream-50"
        >
          <svg
            width={28}
            height={28}
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
          <span className="text-sm font-medium text-ink-700">{label}</span>
          <span className="text-xs text-ink-500">
            JPG, PNG, WEBP or HEIC · up to 12 MB
          </span>
        </label>
      )}

      {error && <p className="mt-1 text-xs text-brand-500">{error}</p>}
    </div>
  );
}
