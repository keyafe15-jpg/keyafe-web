import { useState } from "react";
import { ClipboardPaste, ImagePlus, Sparkles, X } from "lucide-react";
import { Field, inputClass, textareaClass } from "@/components/form/Field";
import { cn } from "@/lib/cn";
import { useParseRecipe, type RecipeDraft } from "@/hooks/useAdminRecipes";
import { parsePastedRecipeText } from "@/pages/recipes/recipe-ui";

export function ScanRecipeBlock({
  disabled,
  onDraft,
  onInsertLines,
}: {
  disabled?: boolean;
  onDraft: (draft: RecipeDraft) => void;
  onInsertLines: (lines: RecipeDraft["ingredients"]) => void;
}) {
  const parse = useParseRecipe();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [context, setContext] = useState("");
  const [paste, setPaste] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pasteNote, setPasteNote] = useState<string | null>(null);

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
      <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">Add from photo or list</p>
      <p className="mt-0.5 text-xs text-slate-500">
        Photo uses a scan. A pasted list is free and stays on this page — check the lines, then save.
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {preview ? (
          <div className="relative">
            <img
              src={preview}
              alt="Recipe preview"
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
            <span className="sr-only">Add recipe photo</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/*"
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
            placeholder="e.g. this is the 250 ml tub"
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
              { image: file, context },
              {
                onSuccess: onDraft,
                onError: (err) =>
                  setError(err instanceof Error ? err.message : "Could not read that recipe"),
              },
            );
          }}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          <Sparkles className="h-4 w-4" />
          {parse.isPending ? "Reading…" : "Read recipe"}
        </button>
      </div>
      <div className="mt-3 border-t border-slate-200/80 pt-3">
        <Field
          label="Or paste a list"
          hint="Free — no scan. One ingredient per line, e.g. maida - 100g"
        >
          <textarea
            value={paste}
            onChange={(e) => setPaste(e.target.value)}
            placeholder={"maida - 100g\nbutter - 50g\nsugar 50g"}
            rows={4}
            className={cn(textareaClass, "min-h-20")}
            disabled={disabled}
          />
        </Field>
        <button
          type="button"
          disabled={disabled || !paste.trim()}
          onClick={() => {
            const { ingredients, skipped } = parsePastedRecipeText(paste);
            if (!ingredients.length) {
              setPasteNote(null);
              setError("Could not read those lines. Use one per line, like maida - 100g.");
              return;
            }
            setError(null);
            setPasteNote(
              skipped
                ? `Inserted ${ingredients.length} — skipped ${skipped} line${skipped === 1 ? "" : "s"} without a qty.`
                : null,
            );
            onInsertLines(
              ingredients.map((l) => ({
                name: l.name,
                qty: l.qty,
                unit: l.unit,
                note: l.note,
              })),
            );
            setPaste("");
          }}
          className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:border-brand-500 hover:text-brand-700 disabled:opacity-50"
        >
          <ClipboardPaste className="h-4 w-4" />
          Insert lines
        </button>
      </div>
      {pasteNote && <p className="mt-2 text-xs text-amber-800">{pasteNote}</p>}
      {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
    </div>
  );
}
