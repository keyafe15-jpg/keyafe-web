import { useRef, useState } from "react";
import { ArrowDown, ArrowUp, Eye, EyeOff, Pencil, Plus, Trash2, Upload, X } from "lucide-react";
import {
  MAX_HIGHLIGHTS,
  useAdminHighlights,
  useCreateHighlight,
  useDeleteHighlight,
  useReorderHighlights,
  useToggleHighlight,
  useUpdateHighlight,
  type Highlight,
  type HighlightInput,
} from "@/hooks/useHighlights";
import { useAdminCategories } from "@/hooks/useAdminCategories";
import { useTags } from "@/hooks/useTags";
import { useAllAdminProducts } from "@/hooks/useAdminProducts";
import { SearchableSelect } from "@/components/form/SearchableSelect";
import { SearchableMultiSelect } from "@/components/form/SearchableMultiSelect";
import { Field, inputClass, submitClass } from "@/components/form/Field";
import { uploadFile } from "@/lib/uploads";
import { cn } from "@/lib/cn";

const DEFAULT_COLOR = "#E31C79";
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;

/** Today's date in India as YYYY-MM-DD, comparable with startDate / endDate. */
function indiaToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
}

type Status = "Live" | "Scheduled" | "Ended" | "Off";

function statusOf(h: Pick<Highlight, "isActive" | "startDate" | "endDate">): Status {
  if (!h.isActive) return "Off";
  const today = indiaToday();
  if (h.startDate && h.startDate > today) return "Scheduled";
  if (h.endDate && h.endDate < today) return "Ended";
  return "Live";
}

const STATUS_CLASS: Record<Status, string> = {
  Live: "bg-emerald-50 text-emerald-700",
  Scheduled: "bg-sky-50 text-sky-700",
  Ended: "bg-slate-100 text-slate-500",
  Off: "bg-slate-100 text-slate-500",
};

function formatDay(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y!, m! - 1, d!).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function windowLabel(h: Pick<Highlight, "startDate" | "endDate">) {
  if (h.startDate && h.endDate) return `${formatDay(h.startDate)} – ${formatDay(h.endDate)}`;
  if (h.startDate) return `From ${formatDay(h.startDate)}`;
  if (h.endDate) return `Until ${formatDay(h.endDate)}`;
  return "Always on";
}

function sourceSummary(h: Highlight) {
  const parts: string[] = [];
  if (h.products.length) parts.push(`${h.products.length} picked`);
  if (h.category) parts.push(h.category.name);
  if (h.tag) parts.push(`#${h.tag.name}`);
  return parts.join(" · ");
}

export function HighlightsPage() {
  const { data: highlights = [], isLoading } = useAdminHighlights();
  const reorder = useReorderHighlights();
  const toggle = useToggleHighlight();
  const remove = useDeleteHighlight();
  const [editing, setEditing] = useState<Highlight | "new" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const atLimit = highlights.length >= MAX_HIGHLIGHTS;

  const move = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= highlights.length) return;
    const ids = highlights.map((h) => h.id);
    [ids[index], ids[target]] = [ids[target]!, ids[index]!];
    setError(null);
    reorder.mutate(ids, {
      onError: (err) => setError(err instanceof Error ? err.message : "Could not reorder"),
    });
  };

  const onDelete = (h: Highlight) => {
    if (!window.confirm(`Delete "${h.title}"? This can't be undone.`)) return;
    setError(null);
    remove.mutate(h.id, {
      onError: (err) => setError(err instanceof Error ? err.message : "Could not delete"),
    });
  };

  return (
    <div className="max-w-4xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Highlights</h1>
          <p className="mt-1 text-sm text-slate-500">
            The &ldquo;Trending&rdquo; tabs under the home page search bar. Feature a festival, a
            category or a few products. Up to {MAX_HIGHLIGHTS}; add dates to make one appear and
            disappear on its own.
          </p>
        </div>
        {editing === null && (
          <button
            type="button"
            onClick={() => setEditing("new")}
            disabled={atLimit || isLoading}
            title={atLimit ? `Maximum ${MAX_HIGHLIGHTS} highlights — delete one first` : undefined}
            className={cn(submitClass, "inline-flex items-center gap-1.5")}
          >
            <Plus className="h-4 w-4" /> Add highlight
          </button>
        )}
      </div>

      {error && <p className="mt-4 text-sm text-brand-600">{error}</p>}

      {editing !== null && (
        <HighlightEditor
          key={editing === "new" ? "new" : editing.id}
          highlight={editing === "new" ? null : editing}
          onDone={() => setEditing(null)}
        />
      )}

      <section className="mt-6 space-y-3">
        <h2 className="text-sm font-semibold text-slate-700">
          Highlights{" "}
          <span className="font-normal text-slate-400">
            {highlights.length}/{MAX_HIGHLIGHTS}
          </span>
        </h2>

        {isLoading ? (
          <div className="rounded-card border border-slate-200 bg-white p-5 text-sm text-slate-500">
            Loading…
          </div>
        ) : highlights.length === 0 ? (
          <div className="rounded-card border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
            No highlights yet. The Trending section stays hidden until one is live.
          </div>
        ) : (
          highlights.map((h, index) => (
            <HighlightRow
              key={h.id}
              highlight={h}
              index={index}
              isFirst={index === 0}
              isLast={index === highlights.length - 1}
              busy={reorder.isPending}
              onMove={(delta) => move(index, delta)}
              onToggle={() => toggle.mutate({ id: h.id, isActive: !h.isActive })}
              onEdit={() => setEditing(h)}
              onDelete={() => onDelete(h)}
            />
          ))
        )}
      </section>
    </div>
  );
}

function HighlightRow({
  highlight: h,
  index,
  isFirst,
  isLast,
  busy,
  onMove,
  onToggle,
  onEdit,
  onDelete,
}: {
  highlight: Highlight;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  busy: boolean;
  onMove: (delta: -1 | 1) => void;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const status = statusOf(h);
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-card border bg-white p-3 shadow-sm sm:flex-row sm:items-center",
        status === "Live" ? "border-slate-200" : "border-dashed border-slate-300",
        !h.isActive && "opacity-70",
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span className="w-5 shrink-0 text-center text-xs font-semibold text-slate-400">
          {index + 1}
        </span>
        <span
          className="h-10 w-10 shrink-0 rounded-lg border border-black/5 bg-cover bg-center"
          style={{
            backgroundColor: h.themeColor,
            backgroundImage: h.bannerImage ? `url(${h.bannerImage})` : undefined,
          }}
          aria-hidden
        />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-900">{h.title}</p>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]">
            <span className={cn("rounded-full px-2 py-0.5 font-medium", STATUS_CLASS[status])}>
              {status}
            </span>
            <span className="text-slate-500">{windowLabel(h)}</span>
            <span className="truncate text-slate-500">{sourceSummary(h)}</span>
          </div>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <IconButton label="Move up" disabled={isFirst || busy} onClick={() => onMove(-1)}>
          <ArrowUp className="h-4 w-4" />
        </IconButton>
        <IconButton label="Move down" disabled={isLast || busy} onClick={() => onMove(1)}>
          <ArrowDown className="h-4 w-4" />
        </IconButton>
        <IconButton label={h.isActive ? "Turn off" : "Turn on"} onClick={onToggle}>
          {h.isActive ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
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

function HighlightEditor({
  highlight,
  onDone,
}: {
  highlight: Highlight | null;
  onDone: () => void;
}) {
  const create = useCreateHighlight();
  const update = useUpdateHighlight();
  const { data: categories = [] } = useAdminCategories();
  const { data: tags = [] } = useTags();
  const { data: products = [] } = useAllAdminProducts("catalog");

  const [title, setTitle] = useState(highlight?.title ?? "");
  const [tagline, setTagline] = useState(highlight?.tagline ?? "");
  const [themeColor, setThemeColor] = useState(highlight?.themeColor ?? DEFAULT_COLOR);
  const [bannerImage, setBannerImage] = useState<string | null>(highlight?.bannerImage ?? null);
  const [startDate, setStartDate] = useState(highlight?.startDate ?? "");
  const [endDate, setEndDate] = useState(highlight?.endDate ?? "");
  const [categoryId, setCategoryId] = useState(highlight?.category?.id ?? "");
  const [tagId, setTagId] = useState(highlight?.tag?.id ?? "");
  const [productIds, setProductIds] = useState<string[]>(
    highlight?.products.map((p) => p.id) ?? [],
  );
  const [isActive, setIsActive] = useState(highlight?.isActive ?? true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const saving = create.isPending || update.isPending;

  const categoryOptions = categories.map((c) => ({
    value: c.id,
    label: c.parentName ? `${c.parentName} › ${c.name}` : c.name,
    keywords: c.slug,
  }));
  const tagOptions = tags.map((t) => ({ value: t.id, label: t.name, keywords: t.slug }));
  const productItems = products.map((p) => ({
    value: p.id,
    label: p.name,
    keywords: p.categories.map((c) => c.name).join(" "),
    imageUrl: p.images[0] ?? null,
  }));

  const pickBanner = async (file: File | null) => {
    if (fileRef.current) fileRef.current.value = "";
    if (!file) return;
    if (!IMAGE_TYPES.includes(file.type)) {
      setError("Use a JPG, PNG or WebP photo.");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setError("Photo is over 12 MB.");
      return;
    }
    setError(null);
    setUploading(true);
    try {
      const res = await uploadFile(file, "hero");
      setBannerImage(res.publicUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const submit = async () => {
    setError(null);
    if (title.trim().length < 2) {
      setError("Add a title.");
      return;
    }
    if (!productIds.length && !categoryId && !tagId) {
      setError("Pick products, a category or a tag.");
      return;
    }
    if (startDate && endDate && endDate < startDate) {
      setError("End date can't be before the start date.");
      return;
    }
    const input: HighlightInput = {
      title: title.trim(),
      tagline: tagline.trim() || null,
      themeColor,
      bannerImage,
      startDate: startDate || null,
      endDate: endDate || null,
      categoryId: categoryId || null,
      tagId: tagId || null,
      productIds,
      isActive,
    };
    try {
      if (highlight) await update.mutateAsync({ id: highlight.id, ...input });
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
          {highlight ? "Edit highlight" : "New highlight"}
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

      <HeaderPreview
        title={title || "Your highlight title"}
        tagline={tagline}
        color={themeColor}
        image={bannerImage}
      />

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <Field label="Title" required hint={`${title.length}/60 · Also the tab name.`}>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value.slice(0, 60))}
            placeholder="Christmas Specials"
            className={inputClass}
          />
        </Field>
        <Field label="Short line (optional)" hint={`${tagline.length}/140`}>
          <input
            value={tagline}
            onChange={(e) => setTagline(e.target.value.slice(0, 140))}
            placeholder="Plum cakes, cookie boxes and hampers for the season"
            className={inputClass}
          />
        </Field>
        <Field label="Theme colour">
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={themeColor}
              onChange={(e) => setThemeColor(e.target.value)}
              aria-label="Theme colour"
              className="h-9 w-12 cursor-pointer rounded border border-slate-200 bg-white p-0.5"
            />
            <input
              value={themeColor}
              onChange={(e) => setThemeColor(e.target.value)}
              className={cn(inputClass, "w-28 font-mono text-xs")}
              aria-label="Theme colour hex"
            />
          </div>
        </Field>
        <Field label="Banner photo (optional)" hint="Wide photo, about 1600 × 500 px.">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:border-brand-500"
            >
              <Upload className="h-4 w-4" />
              {uploading ? "Uploading…" : bannerImage ? "Replace" : "Upload"}
            </button>
            {bannerImage && (
              <button
                type="button"
                onClick={() => setBannerImage(null)}
                className="text-xs font-medium text-slate-500 hover:text-brand-600"
              >
                Remove
              </button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept={IMAGE_TYPES.join(",")}
              className="hidden"
              onChange={(e) => void pickBanner(e.target.files?.[0] ?? null)}
            />
          </div>
        </Field>
        <Field label="Start date (optional)" hint="Empty = live as soon as it's turned on.">
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="End date (optional)" hint="Empty = stays until you turn it off.">
          <input
            type="date"
            value={endDate}
            min={startDate || undefined}
            onChange={(e) => setEndDate(e.target.value)}
            className={inputClass}
          />
        </Field>
      </div>

      <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50/60 p-4">
        <p className="text-sm font-semibold text-slate-900">Products</p>
        <p className="mt-0.5 text-xs text-slate-500">
          Any mix. Picked products show first, then the category and tag fill the row (up to 10).
        </p>
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          <Field label="Pick products">
            <SearchableMultiSelect
              items={productItems}
              selected={productIds}
              onChange={setProductIds}
              placeholder="Search or pick products"
              searchPlaceholder="Search products…"
              allowClearAll
            />
          </Field>
          <Field label="Category" hint="Includes its sub-categories. Also used for “See all”.">
            <SearchableSelect
              value={categoryId}
              onChange={setCategoryId}
              options={categoryOptions}
              placeholder="No category"
              searchPlaceholder="Search categories…"
              allowEmpty
            />
          </Field>
          <Field label="Tag" hint="e.g. a Christmas tag on your festive products.">
            <SearchableSelect
              value={tagId}
              onChange={setTagId}
              options={tagOptions}
              placeholder="No tag"
              searchPlaceholder="Search tags…"
              allowEmpty
            />
          </Field>
        </div>
      </div>

      <label className="mt-4 flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={isActive}
          onChange={(e) => setIsActive(e.target.checked)}
          className="h-4 w-4 rounded border-slate-300 text-brand-500"
        />
        Turned on
      </label>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void submit()}
          disabled={saving || uploading}
          className={submitClass}
        >
          {saving ? "Saving…" : highlight ? "Save highlight" : "Add highlight"}
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

function HeaderPreview({
  title,
  tagline,
  color,
  image,
}: {
  title: string;
  tagline: string;
  color: string;
  image: string | null;
}) {
  return (
    <div className="mt-4">
      <p className="mb-1 text-xs font-medium tracking-wide text-slate-500 uppercase">Preview</p>
      <div
        className="relative overflow-hidden rounded-xl px-4 py-4 text-white"
        style={{ backgroundColor: color }}
      >
        {image && (
          <img
            src={image}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            aria-hidden
          />
        )}
        <div
          className="absolute inset-0"
          style={{ background: `linear-gradient(90deg, ${color} 35%, ${color}66 100%)` }}
          aria-hidden
        />
        <div className="relative">
          <p className="text-lg leading-tight font-semibold">{title}</p>
          {tagline && <p className="mt-0.5 text-sm text-white/85">{tagline}</p>}
        </div>
      </div>
    </div>
  );
}
