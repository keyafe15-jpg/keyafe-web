import { useEffect, useId, useRef, useState } from "react";
import { ImagePlus, X } from "lucide-react";
import { cn } from "@/lib/cn";

export const MAX_REF_IMAGES = 5;
const ACCEPTED = "image/png,image/jpeg,image/webp,image/heic,image/heif";

export function RefImagesPicker({
  keptUrls,
  files,
  onChange,
}: {
  keptUrls: string[];
  files: File[];
  onChange: (keptUrls: string[], files: File[]) => void;
}) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [filePreviews, setFilePreviews] = useState<string[]>([]);

  useEffect(() => {
    const urls = files.map((f) => URL.createObjectURL(f));
    setFilePreviews(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [files]);

  const used = keptUrls.length + files.length;
  const canAdd = used < MAX_REF_IMAGES;

  return (
    <div>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={ACCEPTED}
        multiple
        className="sr-only"
        onChange={(e) => {
          const picked = Array.from(e.target.files ?? []);
          e.target.value = "";
          if (picked.length === 0) return;
          onChange(keptUrls, [...files, ...picked].slice(0, MAX_REF_IMAGES - keptUrls.length));
        }}
      />
      <div className="flex flex-wrap gap-2">
        {keptUrls.map((src) => (
          <span key={src} className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-slate-200">
            <img src={src} alt="" className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => onChange(keptUrls.filter((u) => u !== src), files)}
              className="absolute top-0.5 right-0.5 rounded-full bg-slate-900/70 p-0.5 text-white"
              aria-label="Remove image"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        {files.map((file, idx) => (
          <span
            key={`${file.name}-${idx}`}
            className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-slate-200"
          >
            {filePreviews[idx] && (
              <img src={filePreviews[idx]} alt="" className="h-full w-full object-cover" />
            )}
            <button
              type="button"
              onClick={() => onChange(keptUrls, files.filter((_, i) => i !== idx))}
              className="absolute top-0.5 right-0.5 rounded-full bg-slate-900/70 p-0.5 text-white"
              aria-label="Remove image"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        {canAdd && (
          <label
            htmlFor={inputId}
            className={cn(
              "flex h-14 min-w-14 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-lg border border-dashed border-slate-300 bg-white px-2 text-slate-400 transition hover:border-brand-500 hover:text-brand-600",
              used === 0 && "min-w-[9rem] flex-row gap-2",
            )}
          >
            <ImagePlus className="h-5 w-5 shrink-0" />
            <span className="text-[11px] font-medium text-slate-600">
              {used === 0 ? "Add photos" : `${used}/${MAX_REF_IMAGES}`}
            </span>
          </label>
        )}
      </div>
      <p className="mt-1 text-[11px] text-slate-500">Up to {MAX_REF_IMAGES} reference photos.</p>
    </div>
  );
}
