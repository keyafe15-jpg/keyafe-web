import { useState } from "react";
import { Sparkles } from "lucide-react";
import {
  PHOTO_KINDS,
  useSuggestCopy,
  type SuggestBundle,
  type SuggestContext,
  type SuggestKind,
} from "@/ai/useSuggestCopy";
import { cn } from "@/lib/cn";

export function SuggestCopyButton({
  kind,
  label,
  image,
  context,
  current,
  onPickName,
  onPickMetaTitle,
  onFill,
  className,
}: {
  kind: SuggestKind;
  label: string;
  image?: File | string | null;
  context?: SuggestContext;
  current?: {
    name?: string;
    shortDescription?: string;
    description?: string;
    metaTitle?: string;
    metaDescription?: string;
  };
  onPickName: (name: string) => void;
  onPickMetaTitle?: (title: string) => void;
  onFill?: (bundle: SuggestBundle) => void;
  className?: string;
}) {
  const needsPhoto = PHOTO_KINDS.has(kind);
  const hasPhoto = Boolean(
    image instanceof File ? image.size > 0 : typeof image === "string" && image.trim(),
  );
  const suggest = useSuggestCopy();
  const [names, setNames] = useState<string[]>([]);
  const [metaTitles, setMetaTitles] = useState<string[]>([]);

  if (needsPhoto && !hasPhoto) return null;

  const run = async () => {
    setNames([]);
    setMetaTitles([]);
    if (image instanceof File && /heic|heif/i.test(image.type || image.name)) {
      return;
    }
    try {
      const bundle = await suggest.mutateAsync({
        kind,
        ...context,
        name: context?.name ?? current?.name,
        shortDescription: context?.shortDescription ?? current?.shortDescription,
        description: context?.description ?? current?.description,
        image,
      });
      setNames(bundle.names);
      setMetaTitles(bundle.metaTitle ?? []);
      const filling =
        bundle.shortDescription || bundle.description || bundle.metaDescription;
      if (!filling || !onFill) return;
      const occupied = Boolean(
        current?.shortDescription?.trim() ||
          current?.description?.trim() ||
          current?.metaDescription?.trim(),
      );
      if (occupied && !window.confirm("Replace existing descriptions with the AI draft?")) {
        return;
      }
      onFill(bundle);
    } catch {
      // Error is shown from suggest.error
    }
  };

  const heicBlocked =
    image instanceof File && /heic|heif/i.test(image.type || image.name);

  return (
    <div className={cn("space-y-1.5", className)}>
      <button
        type="button"
        onClick={() => void run()}
        disabled={suggest.isPending || heicBlocked}
        className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:text-brand-900 disabled:opacity-60"
      >
        <Sparkles className="h-3 w-3" />
        {suggest.isPending ? "Suggesting…" : label}
      </button>
      {heicBlocked && (
        <p className="text-xs text-brand-500">Use a JPEG, PNG, or WebP photo.</p>
      )}
      {suggest.isError && (
        <p className="text-xs text-brand-500">
          {suggest.error instanceof Error ? suggest.error.message : "Could not suggest"}
        </p>
      )}
      {names.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {names.map((text) => (
            <button
              key={text}
              type="button"
              onClick={() => onPickName(text)}
              className="max-w-full rounded-full border border-brand-200 bg-brand-50 px-2.5 py-1 text-left text-xs font-medium text-brand-800 hover:border-brand-400 hover:bg-brand-100"
            >
              {text}
            </button>
          ))}
        </div>
      )}
      {metaTitles.length > 0 && onPickMetaTitle && (
        <div className="flex flex-wrap gap-1.5">
          {metaTitles.map((text) => (
            <button
              key={text}
              type="button"
              onClick={() => onPickMetaTitle(text)}
              className="max-w-full rounded-full border border-slate-200 bg-white px-2.5 py-1 text-left text-xs font-medium text-slate-700 hover:border-brand-300 hover:bg-brand-50"
            >
              {text}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
