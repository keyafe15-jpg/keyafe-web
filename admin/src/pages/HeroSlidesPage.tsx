import { useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Eye,
  EyeOff,
  Film,
  ImageIcon,
  Pencil,
  Plus,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import {
  MAX_HERO_SLIDES,
  useAdminHeroSlides,
  useCreateHeroSlide,
  useDeleteHeroSlide,
  useReorderHeroSlides,
  useToggleHeroSlide,
  useUpdateHeroSlide,
  type HeroMediaType,
  type HeroSlide,
  type HeroSlideInput,
} from "@/hooks/useHeroSlides";
import { uploadFile } from "@/lib/uploads";
import { Field, inputClass, submitClass } from "@/components/form/Field";
import { cn } from "@/lib/cn";

// The storefront frame is full-width × 400–480px on desktop and ~390×280 on
// phones, with object-cover cropping — these sizes crop the least.
const SIZES = {
  desktop: { width: 1920, height: 640, label: "1920 × 640 px (3:1)" },
  mobile: { width: 1200, height: 800, label: "1200 × 800 px (3:2)" },
} as const;

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const VIDEO_TYPES = ["video/mp4", "video/webm"];
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
const MAX_VIDEO_BYTES = 40 * 1024 * 1024;

type Size = (typeof SIZES)[keyof typeof SIZES];

export function HeroSlidesPage() {
  const { data: slides = [], isLoading } = useAdminHeroSlides();
  const reorder = useReorderHeroSlides();
  const toggle = useToggleHeroSlide();
  const remove = useDeleteHeroSlide();
  const [editing, setEditing] = useState<HeroSlide | "new" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const atLimit = slides.length >= MAX_HERO_SLIDES;

  const move = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= slides.length) return;
    const ids = slides.map((s) => s.id);
    [ids[index], ids[target]] = [ids[target], ids[index]];
    setError(null);
    reorder.mutate(ids, {
      onError: (err) => setError(err instanceof Error ? err.message : "Could not reorder"),
    });
  };

  const onDelete = (slide: HeroSlide) => {
    const name = slide.title?.trim() || "this slide";
    if (!window.confirm(`Delete ${name}? This can't be undone.`)) return;
    setError(null);
    remove.mutate(slide.id, {
      onError: (err) => setError(err instanceof Error ? err.message : "Could not delete"),
    });
  };

  return (
    <div className="max-w-4xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Hero slider</h1>
          <p className="mt-1 text-sm text-slate-500">
            The big carousel at the top of the home page. Up to {MAX_HERO_SLIDES} slides — photos or
            short videos.
          </p>
        </div>
        {editing === null && (
          <button
            type="button"
            onClick={() => setEditing("new")}
            disabled={atLimit || isLoading}
            title={atLimit ? `Maximum ${MAX_HERO_SLIDES} slides — delete one first` : undefined}
            className={cn(submitClass, "inline-flex items-center gap-1.5")}
          >
            <Plus className="h-4 w-4" /> Add slide
          </button>
        )}
      </div>

      <SizeGuide />

      {error && <p className="mt-4 text-sm text-brand-600">{error}</p>}

      {editing !== null && (
        <SlideEditor
          key={editing === "new" ? "new" : editing.id}
          slide={editing === "new" ? null : editing}
          onDone={() => setEditing(null)}
        />
      )}

      <section className="mt-6 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700">
            Slides{" "}
            <span className="font-normal text-slate-400">
              {slides.length}/{MAX_HERO_SLIDES}
            </span>
          </h2>
        </div>

        {isLoading ? (
          <div className="rounded-card border border-slate-200 bg-white p-5 text-sm text-slate-500">
            Loading…
          </div>
        ) : slides.length === 0 ? (
          <div className="rounded-card border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
            No slides yet. Until one is live, the home page shows a plain Keyafe banner.
          </div>
        ) : (
          slides.map((slide, index) => (
            <SlideRow
              key={slide.id}
              slide={slide}
              index={index}
              isFirst={index === 0}
              isLast={index === slides.length - 1}
              busy={reorder.isPending}
              onMove={(delta) => move(index, delta)}
              onToggle={() => toggle.mutate({ id: slide.id, isActive: !slide.isActive })}
              onEdit={() => setEditing(slide)}
              onDelete={() => onDelete(slide)}
            />
          ))
        )}
      </section>
    </div>
  );
}

function SizeGuide() {
  return (
    <div className="mt-5 rounded-card border border-sky-200 bg-sky-50/60 p-4 text-sm text-slate-700">
      <p className="font-semibold text-slate-900">Recommended sizes</p>
      <ul className="mt-2 space-y-1.5">
        <li>
          <span className="font-medium">Desktop:</span> {SIZES.desktop.label}. Wide screens crop the
          top and bottom, narrow ones crop the sides — keep faces, text and the cake in the middle
          60%.
        </li>
        <li>
          <span className="font-medium">Mobile (optional):</span> {SIZES.mobile.label}. Without one,
          phones show a centre crop of the desktop file.
        </li>
        <li>
          <span className="font-medium">Photos:</span> JPG, PNG or WebP, up to 12 MB (aim for under
          500 KB so the page loads fast).
        </li>
        <li>
          <span className="font-medium">Videos:</span> MP4 (H.264) or WebM, same sizes, 5–15
          seconds, up to 40 MB (aim for under 8 MB). They play muted, so sound is ignored. iPhone
          .mov files won&apos;t upload — export as MP4 first. Add a poster photo; it shows while the
          video loads and when a phone blocks autoplay.
        </li>
      </ul>
    </div>
  );
}

function SlideRow({
  slide,
  index,
  isFirst,
  isLast,
  busy,
  onMove,
  onToggle,
  onEdit,
  onDelete,
}: {
  slide: HeroSlide;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  busy: boolean;
  onMove: (delta: -1 | 1) => void;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const isVideo = slide.mediaType === "VIDEO";
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-card border bg-white p-3 shadow-sm sm:flex-row sm:items-center",
        slide.isActive ? "border-slate-200" : "border-dashed border-slate-300 opacity-70",
      )}
    >
      <div className="flex items-center gap-3 sm:w-72 sm:shrink-0">
        <span className="w-5 text-center text-xs font-semibold text-slate-400">{index + 1}</span>
        <div className="relative aspect-[3/1] w-full overflow-hidden rounded-md bg-slate-100">
          {isVideo ? (
            <video
              src={slide.desktopUrl}
              poster={slide.posterUrl ?? undefined}
              muted
              playsInline
              preload="metadata"
              className="h-full w-full object-cover"
            />
          ) : (
            <img src={slide.desktopUrl} alt="" className="h-full w-full object-cover" />
          )}
          <span className="absolute top-1 left-1 inline-flex items-center gap-1 rounded bg-slate-900/70 px-1.5 py-0.5 text-[10px] font-medium text-white">
            {isVideo ? <Film className="h-3 w-3" /> : <ImageIcon className="h-3 w-3" />}
            {isVideo ? "Video" : "Photo"}
          </span>
        </div>
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-slate-900">
          {slide.title || <span className="font-normal text-slate-400">No title (media only)</span>}
        </p>
        {slide.subtitle && <p className="truncate text-xs text-slate-500">{slide.subtitle}</p>}
        <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px]">
          <span
            className={cn(
              "rounded-full px-2 py-0.5 font-medium",
              slide.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500",
            )}
          >
            {slide.isActive ? "Live" : "Hidden"}
          </span>
          {slide.mobileUrl && (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">
              Mobile version
            </span>
          )}
          {slide.linkUrl && <span className="truncate text-slate-500">→ {slide.linkUrl}</span>}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <IconButton label="Move up" disabled={isFirst || busy} onClick={() => onMove(-1)}>
          <ArrowUp className="h-4 w-4" />
        </IconButton>
        <IconButton label="Move down" disabled={isLast || busy} onClick={() => onMove(1)}>
          <ArrowDown className="h-4 w-4" />
        </IconButton>
        <IconButton label={slide.isActive ? "Hide" : "Show"} onClick={onToggle}>
          {slide.isActive ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </IconButton>
        <IconButton label="Edit" onClick={onEdit}>
          <Pencil className="h-4 w-4" />
        </IconButton>
        <IconButton label="Delete" onClick={onDelete} danger>
          <Trash2 className="h-4 w-4" />
        </IconButton>
      </div>
    </div>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={cn(
        "rounded-md p-1.5 text-slate-500 transition hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent",
        danger ? "hover:text-brand-600" : "hover:text-slate-800",
      )}
    >
      {children}
    </button>
  );
}

function SlideEditor({ slide, onDone }: { slide: HeroSlide | null; onDone: () => void }) {
  const create = useCreateHeroSlide();
  const update = useUpdateHeroSlide();
  const [mediaType, setMediaType] = useState<HeroMediaType>(slide?.mediaType ?? "IMAGE");
  const [desktopUrl, setDesktopUrl] = useState<string | null>(slide?.desktopUrl ?? null);
  const [mobileUrl, setMobileUrl] = useState<string | null>(slide?.mobileUrl ?? null);
  const [posterUrl, setPosterUrl] = useState<string | null>(slide?.posterUrl ?? null);
  const [title, setTitle] = useState(slide?.title ?? "");
  const [subtitle, setSubtitle] = useState(slide?.subtitle ?? "");
  const [linkUrl, setLinkUrl] = useState(slide?.linkUrl ?? "");
  const [isActive, setIsActive] = useState(slide?.isActive ?? true);
  const [uploadingCount, setUploadingCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const saving = create.isPending || update.isPending;
  const uploading = uploadingCount > 0;
  const mediaKind = mediaType === "VIDEO" ? "video" : "image";

  const switchType = (next: HeroMediaType) => {
    if (next === mediaType) return;
    // Files are type-specific, so a switch starts the media fields over.
    setMediaType(next);
    setDesktopUrl(null);
    setMobileUrl(null);
    setPosterUrl(null);
  };

  const trackUpload = (delta: 1 | -1) => setUploadingCount((n) => n + delta);

  const submit = async () => {
    setError(null);
    if (!desktopUrl) {
      setError(`Upload the desktop ${mediaKind} first.`);
      return;
    }
    const input: HeroSlideInput = {
      mediaType,
      desktopUrl,
      mobileUrl,
      posterUrl: mediaType === "VIDEO" ? posterUrl : null,
      title: title.trim() || null,
      subtitle: subtitle.trim() || null,
      linkUrl: linkUrl.trim() || null,
      isActive,
    };
    try {
      if (slide) await update.mutateAsync({ id: slide.id, ...input });
      else await create.mutateAsync(input);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    }
  };

  return (
    <section className="mt-6 rounded-card border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-900">
          {slide ? "Edit slide" : "New slide"}
        </h2>
        <button
          type="button"
          onClick={onDone}
          className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-4 inline-flex rounded-lg border border-slate-200 p-0.5">
        {(["IMAGE", "VIDEO"] as const).map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => switchType(type)}
            disabled={uploading}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition",
              mediaType === type
                ? "bg-slate-900 text-white"
                : "text-slate-600 hover:text-slate-900",
            )}
          >
            {type === "IMAGE" ? <ImageIcon className="h-4 w-4" /> : <Film className="h-4 w-4" />}
            {type === "IMAGE" ? "Photo" : "Video"}
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <MediaUpload
          label={`Desktop ${mediaKind}`}
          required
          kind={mediaKind}
          size={SIZES.desktop}
          url={desktopUrl}
          onChange={setDesktopUrl}
          onUploading={trackUpload}
        />
        <MediaUpload
          label={`Mobile ${mediaKind} (optional)`}
          kind={mediaKind}
          size={SIZES.mobile}
          url={mobileUrl}
          onChange={setMobileUrl}
          onUploading={trackUpload}
        />
        {mediaType === "VIDEO" && (
          <MediaUpload
            label="Poster photo (recommended)"
            kind="image"
            size={SIZES.desktop}
            url={posterUrl}
            onChange={setPosterUrl}
            onUploading={trackUpload}
          />
        )}
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <Field
          label="Title (optional)"
          hint={`${title.length}/80 · Leave blank for a media-only slide with no text box.`}
        >
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value.slice(0, 80))}
            placeholder="Celebration cakes"
            className={inputClass}
          />
        </Field>
        <Field label="Subtitle (optional)" hint={`${subtitle.length}/160`}>
          <input
            value={subtitle}
            onChange={(e) => setSubtitle(e.target.value.slice(0, 160))}
            placeholder="Birthdays, weddings and custom art — start here."
            className={inputClass}
          />
        </Field>
        <Field
          label="Link (optional)"
          hint="Where a tap goes: /category/pizzas, /same-day, or a https URL."
        >
          <input
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            placeholder="/category/celebration-cakes"
            className={inputClass}
          />
        </Field>
        <label className="flex items-center gap-2 self-center text-sm text-slate-700">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-brand-500"
          />
          Show on the website
        </label>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void submit()}
          disabled={saving || uploading}
          className={submitClass}
        >
          {uploading ? "Uploading…" : saving ? "Saving…" : slide ? "Save slide" : "Add slide"}
        </button>
        <button
          type="button"
          onClick={onDone}
          disabled={saving}
          className="text-sm font-medium text-slate-500 hover:text-slate-800"
        >
          Cancel
        </button>
        {error && <span className="text-xs text-brand-600">{error}</span>}
      </div>
    </section>
  );
}

type Dimensions = { width: number; height: number };

function readDimensions(file: File, kind: "image" | "video"): Promise<Dimensions | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const done = (dims: Dimensions | null) => {
      URL.revokeObjectURL(url);
      resolve(dims);
    };
    if (kind === "image") {
      const img = new Image();
      img.onload = () => done({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => done(null);
      img.src = url;
    } else {
      const video = document.createElement("video");
      video.preload = "metadata";
      video.onloadedmetadata = () => done({ width: video.videoWidth, height: video.videoHeight });
      video.onerror = () => done(null);
      video.src = url;
    }
  });
}

function dimensionWarning(dims: Dimensions, size: Size): string | null {
  const ratio = dims.width / dims.height;
  const target = size.width / size.height;
  if (Math.abs(ratio - target) / target > 0.2) {
    return `Shape is ${ratio.toFixed(2)}:1 but ${target.toFixed(1)}:1 is recommended — expect heavy cropping.`;
  }
  if (dims.width < size.width * 0.6) {
    return `Only ${dims.width}px wide — may look blurry. ${size.width}px is recommended.`;
  }
  return null;
}

function MediaUpload({
  label,
  required,
  kind,
  size,
  url,
  onChange,
  onUploading,
}: {
  label: string;
  required?: boolean;
  kind: "image" | "video";
  size: Size;
  url: string | null;
  onChange: (url: string | null) => void;
  onUploading: (delta: 1 | -1) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<{ dims: Dimensions; warning: string | null } | null>(null);

  const accepted = kind === "video" ? VIDEO_TYPES : IMAGE_TYPES;
  const maxBytes = kind === "video" ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;

  // The picked file's details only describe the current upload.
  useEffect(() => {
    if (!url) setInfo(null);
  }, [url]);

  const pick = async (file: File | null) => {
    if (inputRef.current) inputRef.current.value = "";
    if (!file) return;
    setError(null);
    if (!accepted.includes(file.type)) {
      setError(kind === "video" ? "Use an MP4 or WebM video." : "Use a JPG, PNG or WebP photo.");
      return;
    }
    if (file.size > maxBytes) {
      setError(
        `Too large (${(file.size / (1024 * 1024)).toFixed(1)} MB). Max ${maxBytes / (1024 * 1024)} MB.`,
      );
      return;
    }

    setBusy(true);
    onUploading(1);
    try {
      const dims = await readDimensions(file, kind);
      const res = await uploadFile(file, "hero");
      onChange(res.publicUrl);
      setInfo(dims ? { dims, warning: dimensionWarning(dims, size) } : null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
      onUploading(-1);
    }
  };

  return (
    <div>
      <p className="mb-1 text-xs font-medium tracking-wide text-slate-500 uppercase">
        {label}
        {required && <span className="ml-1 text-brand-500">*</span>}
      </p>
      <div className="relative overflow-hidden rounded-lg border border-dashed border-slate-300 bg-slate-50/60">
        {url ? (
          <div className="group relative">
            {kind === "video" ? (
              <video
                src={url}
                muted
                loop
                autoPlay
                playsInline
                className="aspect-[3/1] w-full bg-slate-900 object-cover"
              />
            ) : (
              <img src={url} alt="" className="aspect-[3/1] w-full object-cover" />
            )}
            <div className="absolute top-1.5 right-1.5 flex gap-1">
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={busy}
                className="rounded-md bg-slate-900/70 px-2 py-1 text-[11px] font-medium text-white hover:bg-slate-900"
              >
                Replace
              </button>
              <button
                type="button"
                onClick={() => onChange(null)}
                disabled={busy}
                aria-label="Remove"
                className="rounded-md bg-slate-900/70 p-1 text-white hover:bg-slate-900"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="flex aspect-[3/1] w-full flex-col items-center justify-center gap-1 text-center transition hover:border-brand-500 hover:bg-slate-50"
          >
            <Upload className="h-5 w-5 text-slate-400" />
            <span className="text-sm font-medium text-slate-700">
              Upload {kind === "video" ? "video" : "photo"}
            </span>
            <span className="text-[11px] text-slate-500">
              {size.label} · {kind === "video" ? "MP4/WebM ≤ 40 MB" : "JPG/PNG/WebP ≤ 12 MB"}
            </span>
          </button>
        )}
        {busy && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/75 text-sm font-medium text-slate-600">
            Uploading…
          </div>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={accepted.join(",")}
        className="hidden"
        onChange={(e) => void pick(e.target.files?.[0] ?? null)}
      />
      {info && (
        <p className={cn("mt-1 text-xs", info.warning ? "text-amber-700" : "text-emerald-700")}>
          {info.dims.width} × {info.dims.height}px
          {info.warning ? ` · ${info.warning}` : " · good fit"}
        </p>
      )}
      {error && <p className="mt-1 text-xs text-brand-600">{error}</p>}
    </div>
  );
}
