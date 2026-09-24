import { useCallback, useEffect, useId, useMemo, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { ChevronDown, SlidersHorizontal, X } from "lucide-react";
import { useMasterFlavours } from "@/hooks/useFlavours";
import { cn } from "@/lib/cn";
import {
  type CatalogDiet,
  type CatalogFilterState,
  type CatalogHeat,
  type CatalogSort,
  CATALOG_PRICE_CEILING,
  CATALOG_PRICE_FLOOR,
  CATALOG_PRICE_STEP,
  EMPTY_CATALOG_FILTERS,
  catalogFiltersAreActive,
  catalogFiltersFromSearchParams,
  writeCatalogFiltersToSearchParams,
} from "@/lib/catalogFilters";
import { presetForDepartment } from "@/lib/catalogFilterPresets";

type CatalogFiltersProps = {
  className?: string;
  /** Store department slug (`dessert` / `savory`) — picks which controls show. */
  departmentSlug?: string | null;
  /** Called when filters change so the parent can reset pagination. */
  onChange?: (filters: CatalogFilterState) => void;
  /** Start expanded. Defaults to collapsed (better on mobile). */
  defaultOpen?: boolean;
};

/**
 * Shared catalogue filters for category / search / tag / specialty pages.
 * Collapsed by default into a compact bar; expands to reveal controls.
 * State lives in the URL so filters are shareable and survive back/forward.
 */
export function CatalogFilters({
  className,
  departmentSlug,
  onChange,
  defaultOpen = false,
}: CatalogFiltersProps) {
  const panelId = useId();
  const [open, setOpen] = useState(defaultOpen);
  const [params, setParams] = useSearchParams();
  const preset = useMemo(() => presetForDepartment(departmentSlug), [departmentSlug]);
  const { data: flavours = [] } = useMasterFlavours();
  const filters = useMemo(() => catalogFiltersFromSearchParams(params), [params]);
  const active = catalogFiltersAreActive(filters);
  const summary = useMemo(() => summarizeActiveFilters(filters, flavours), [filters, flavours]);

  const urlMin = parseBound(filters.minPrice, CATALOG_PRICE_FLOOR);
  const urlMax = parseBound(filters.maxPrice, CATALOG_PRICE_CEILING);

  const [localMin, setLocalMin] = useState(urlMin);
  const [localMax, setLocalMax] = useState(urlMax);

  useEffect(() => {
    setLocalMin(urlMin);
    setLocalMax(urlMax);
  }, [urlMin, urlMax]);

  const patch = useCallback(
    (next: Partial<CatalogFilterState>) => {
      const merged: CatalogFilterState = { ...filters, ...next };
      setParams(
        (prev) => {
          const nextParams = new URLSearchParams(prev);
          writeCatalogFiltersToSearchParams(nextParams, merged);
          return nextParams;
        },
        { replace: true },
      );
      onChange?.(merged);
    },
    [filters, setParams, onChange],
  );

  function commitPrice(min: number, max: number) {
    patch({
      minPrice: min <= CATALOG_PRICE_FLOOR ? "" : String(min),
      maxPrice: max >= CATALOG_PRICE_CEILING ? "" : String(max),
    });
  }

  function clearAll(e?: React.MouseEvent) {
    e?.stopPropagation();
    setLocalMin(CATALOG_PRICE_FLOOR);
    setLocalMax(CATALOG_PRICE_CEILING);
    setParams(
      (prev) => {
        const nextParams = new URLSearchParams(prev);
        writeCatalogFiltersToSearchParams(nextParams, EMPTY_CATALOG_FILTERS);
        return nextParams;
      },
      { replace: true },
    );
    onChange?.(EMPTY_CATALOG_FILTERS);
  }

  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-cream-200 bg-white/70 shadow-sm",
        className,
      )}
    >
      <div className="flex items-center gap-2 px-3 py-2.5">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((v) => !v)}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          <SlidersHorizontal className="h-4 w-4 shrink-0 text-brand-500" aria-hidden="true" />
          <span className="text-xs font-semibold tracking-[0.18em] text-ink-700 uppercase">
            Filters
          </span>
          {summary.count > 0 && (
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-500 px-1.5 text-[10px] font-semibold text-white">
              {summary.count}
            </span>
          )}
          {!open && summary.label && (
            <span className="min-w-0 truncate text-xs text-ink-500">{summary.label}</span>
          )}
          <ChevronDown
            className={cn(
              "ml-auto h-4 w-4 shrink-0 text-ink-500 transition-transform duration-200",
              open && "rotate-180",
            )}
            aria-hidden="true"
          />
        </button>
        {active && (
          <button
            type="button"
            onClick={clearAll}
            className="hover:border-brand-200 hover:text-brand-600 inline-flex shrink-0 items-center gap-1 rounded-full border border-cream-200 bg-cream-50 px-2.5 py-1 text-xs font-medium text-ink-700 transition"
            aria-label="Clear filters"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
            Clear
          </button>
        )}
      </div>

      <div id={panelId} hidden={!open} className="border-t border-cream-200 px-3 pt-3 pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          {preset.flavor && (
            <FilterField label="Flavour">
              <div className="relative">
                <select
                  value={filters.flavor}
                  onChange={(e) => patch({ flavor: e.target.value })}
                  className={selectClass}
                >
                  <option value="">All flavours</option>
                  {flavours.map((f) => (
                    <option key={f.id} value={f.slug}>
                      {f.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className={chevronClass} aria-hidden="true" />
              </div>
            </FilterField>
          )}

          {preset.sort && (
            <FilterField label="Sort">
              <div className="relative">
                <select
                  value={filters.sort}
                  onChange={(e) => patch({ sort: e.target.value as CatalogSort })}
                  className={selectClass}
                >
                  <option value="featured">Featured</option>
                  <option value="price_asc">Price: low to high</option>
                  <option value="price_desc">Price: high to low</option>
                </select>
                <ChevronDown className={chevronClass} aria-hidden="true" />
              </div>
            </FilterField>
          )}

          {preset.price && (
            <div className="flex min-w-0 flex-col gap-1 sm:max-w-xs sm:min-w-[220px] sm:flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[11px] font-medium tracking-wide text-ink-500 uppercase">
                  Price
                </span>
                <span className="text-xs text-ink-700 tabular-nums">
                  ₹{localMin.toLocaleString("en-IN")} – ₹{localMax.toLocaleString("en-IN")}
                  {localMax >= CATALOG_PRICE_CEILING ? "+" : ""}
                </span>
              </div>
              <PriceRangeSlider
                min={localMin}
                max={localMax}
                onChange={(nextMin, nextMax) => {
                  setLocalMin(nextMin);
                  setLocalMax(nextMax);
                }}
                onCommit={commitPrice}
              />
            </div>
          )}

          {preset.shape && (
            <FilterField label="Shape">
              <div className="relative">
                <select
                  disabled
                  className={cn(selectClass, "cursor-not-allowed opacity-60")}
                  value=""
                >
                  <option value="">Coming soon</option>
                </select>
                <ChevronDown className={chevronClass} aria-hidden="true" />
              </div>
            </FilterField>
          )}

          {(preset.noCream || preset.fixedDesign) && (
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-medium tracking-wide text-ink-500 uppercase">
                Style
              </span>
              <div className="flex flex-wrap gap-1.5">
                {preset.noCream && (
                  <ToggleChip
                    label="No cream"
                    active={filters.noCream}
                    onClick={() => patch({ noCream: !filters.noCream })}
                  />
                )}
                {preset.fixedDesign && (
                  <ToggleChip
                    label="Fixed design"
                    active={filters.fixedDesign}
                    onClick={() => patch({ fixedDesign: !filters.fixedDesign })}
                  />
                )}
              </div>
            </div>
          )}

          {preset.diet && (
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-medium tracking-wide text-ink-500 uppercase">
                Diet
              </span>
              <Segmented
                value={filters.diet}
                onChange={(diet) => patch({ diet: diet as CatalogDiet })}
                options={[
                  { value: "", label: "All" },
                  { value: "veg", label: "Veg" },
                  { value: "nonveg", label: "Non-veg" },
                ]}
              />
            </div>
          )}

          {preset.heat && (
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-medium tracking-wide text-ink-500 uppercase">
                Heat
              </span>
              <Segmented
                value={filters.heat}
                onChange={(heat) => patch({ heat: heat as CatalogHeat })}
                options={[
                  { value: "", label: "All" },
                  { value: "spicy", label: "Spicy" },
                  { value: "mild", label: "Mild" },
                ]}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function summarizeActiveFilters(
  filters: CatalogFilterState,
  flavours: { slug: string; name: string }[],
): { count: number; label: string } {
  const bits: string[] = [];
  if (filters.flavor) {
    bits.push(flavours.find((f) => f.slug === filters.flavor)?.name ?? filters.flavor);
  }
  if (filters.sort === "price_asc") bits.push("Price ↑");
  if (filters.sort === "price_desc") bits.push("Price ↓");
  if (filters.minPrice || filters.maxPrice) {
    const lo = filters.minPrice || "0";
    const hi = filters.maxPrice || "…";
    bits.push(`₹${lo}–${hi}`);
  }
  if (filters.noCream) bits.push("No cream");
  if (filters.fixedDesign) bits.push("Fixed design");
  if (filters.diet === "veg") bits.push("Veg");
  if (filters.diet === "nonveg") bits.push("Non-veg");
  if (filters.heat === "spicy") bits.push("Spicy");
  if (filters.heat === "mild") bits.push("Mild");
  return { count: bits.length, label: bits.join(" · ") };
}

function ToggleChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1.5 text-sm font-medium transition",
        active
          ? "border-brand-500 bg-brand-500 text-white shadow-[0_8px_16px_rgba(227,28,121,0.2)]"
          : "hover:border-brand-200 hover:text-brand-600 border-cream-200 bg-white text-ink-700",
      )}
    >
      {label}
    </button>
  );
}

function Segmented({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="inline-flex rounded-full border border-cream-200 bg-white p-0.5">
      {options.map((opt) => (
        <button
          key={opt.value || "all"}
          type="button"
          onClick={() => onChange(opt.value)}
          className={cn(
            "rounded-full px-3 py-1.5 text-xs font-medium transition sm:text-sm",
            value === opt.value
              ? "bg-brand-500 text-white shadow-sm"
              : "hover:text-brand-600 text-ink-700",
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function PriceRangeSlider({
  min,
  max,
  onChange,
  onCommit,
}: {
  min: number;
  max: number;
  onChange: (min: number, max: number) => void;
  onCommit: (min: number, max: number) => void;
}) {
  const span = CATALOG_PRICE_CEILING - CATALOG_PRICE_FLOOR || 1;
  const leftPct = ((min - CATALOG_PRICE_FLOOR) / span) * 100;
  const rightPct = ((max - CATALOG_PRICE_FLOOR) / span) * 100;

  function setMin(raw: number) {
    onChange(Math.min(raw, max - CATALOG_PRICE_STEP), max);
  }

  function setMax(raw: number) {
    onChange(min, Math.max(raw, min + CATALOG_PRICE_STEP));
  }

  return (
    <div className="relative h-9 w-full touch-none select-none">
      <div className="pointer-events-none absolute inset-x-1 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-cream-200">
        <div
          className="absolute top-0 h-full rounded-full bg-brand-500"
          style={{ left: `${leftPct}%`, width: `${Math.max(0, rightPct - leftPct)}%` }}
        />
      </div>

      <input
        type="range"
        className="catalog-price-thumb"
        min={CATALOG_PRICE_FLOOR}
        max={CATALOG_PRICE_CEILING}
        step={CATALOG_PRICE_STEP}
        value={min}
        aria-label="Minimum price"
        onChange={(e) => setMin(Number(e.target.value))}
        onPointerUp={() => onCommit(min, max)}
        onKeyUp={() => onCommit(min, max)}
        style={{ zIndex: min > CATALOG_PRICE_CEILING - CATALOG_PRICE_STEP * 4 ? 5 : 3 }}
      />
      <input
        type="range"
        className="catalog-price-thumb"
        min={CATALOG_PRICE_FLOOR}
        max={CATALOG_PRICE_CEILING}
        step={CATALOG_PRICE_STEP}
        value={max}
        aria-label="Maximum price"
        onChange={(e) => setMax(Number(e.target.value))}
        onPointerUp={() => onCommit(min, max)}
        onKeyUp={() => onCommit(min, max)}
        style={{ zIndex: 4 }}
      />
    </div>
  );
}

function parseBound(raw: string, fallback: number) {
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

function FilterField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="text-[11px] font-medium tracking-wide text-ink-500 uppercase">{label}</span>
      {children}
    </label>
  );
}

const selectClass =
  "h-9 w-full appearance-none rounded-full border border-cream-200 bg-white py-1.5 pr-8 pl-3 text-sm text-ink-900 outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-500/20 sm:w-44";

const chevronClass =
  "pointer-events-none absolute top-1/2 right-2.5 h-3.5 w-3.5 -translate-y-1/2 text-ink-500";
