import { useState } from "react";
import { Download, X } from "lucide-react";
import {
  useBulkCreateProducts,
  useExportProducts,
  type BulkProductImportRow,
  type ProductTemplate,
} from "@/hooks/useAdminProducts";
import { BulkSpreadsheetImport } from "@/components/form/BulkSpreadsheetImport";
import {
  cellString,
  parseBoolean,
  splitList,
  toNumberOrNull,
} from "@/lib/spreadsheetImport";
import { downloadSpreadsheet } from "@/lib/downloadSpreadsheet";
import { ProductsQuickBulkAdd } from "@/components/products/ProductsQuickBulkAdd";
import { cn } from "@/lib/cn";

const COLUMNS_HINT =
  "name, categorySlugs (comma/semicolon), basePrice; optional: slug, template, productType, shortDescription, images (URLs), gstRate, hsnCode, isEggless, isSpicy, sellByPound, supportsSameDayDelivery, canBeDeliveredPanIndia, isActive, isAvailable, isFeatured, sortOrder";

const SAMPLE_TEMPLATE_ROW = {
  name: "Chocolate Truffle Cake",
  slug: "chocolate-truffle-cake",
  categorySlugs: "cakes; celebration",
  basePrice: 799,
  template: "CAKE",
  productType: "CONFIGURABLE",
  shortDescription: "Rich chocolate layers",
  images: "https://example.com/cake.jpg",
  gstRate: 5,
  hsnCode: "1905",
  isEggless: true,
  isSpicy: false,
  sellByPound: true,
  supportsSameDayDelivery: true,
  canBeDeliveredPanIndia: false,
  isActive: true,
  isAvailable: true,
  isFeatured: false,
  sortOrder: 0,
};

function parseTemplate(value: unknown): ProductTemplate {
  const t = cellString(value).toUpperCase();
  if (t === "PIZZA" || t === "OTHER" || t === "CAKE") return t;
  return "CAKE";
}

function parseProductType(value: unknown): "FIXED_VARIANTS" | "CONFIGURABLE" {
  const t = cellString(value).toUpperCase().replace(/[\s-]/g, "_");
  if (t === "FIXED_VARIANTS" || t === "FIXEDVARIANTS") return "FIXED_VARIANTS";
  return "CONFIGURABLE";
}

function isUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export function parseProductImportRow(
  row: Record<string, unknown>,
): BulkProductImportRow | null {
  const name = cellString(row.name ?? row.productname);
  if (name.length < 2) return null;

  const categorySlugs = splitList(row.categoryslugs ?? row.categories ?? row.categoryslug);
  if (categorySlugs.length === 0) return null;

  const basePrice = toNumberOrNull(row.baseprice ?? row.price);
  if (basePrice === null || basePrice < 0) return null;

  const slugRaw = cellString(row.slug);
  if (slugRaw && !/^[a-z0-9-]+$/.test(slugRaw)) return null;

  const images = splitList(row.images ?? row.imageurls ?? row.image).filter(isUrl);

  return {
    name,
    slug: slugRaw || null,
    categorySlugs,
    basePrice,
    template: parseTemplate(row.template ?? row.producttemplate),
    productType: parseProductType(row.producttype),
    shortDescription: cellString(row.shortdescription ?? row.description) || null,
    images,
    gstRate: toNumberOrNull(row.gstrate) ?? undefined,
    hsnCode: cellString(row.hsncode) || undefined,
    isEggless: parseBoolean(row.iseggless, true),
    isSpicy: parseBoolean(row.isspicy, false),
    sellByPound: parseBoolean(row.sellbypound, false),
    supportsSameDayDelivery: parseBoolean(row.supportssamedaydelivery ?? row.sameday, false),
    canBeDeliveredPanIndia: parseBoolean(row.canbedeliveredpanindia ?? row.panindia, false),
    isActive: parseBoolean(row.isactive, true),
    isAvailable: parseBoolean(row.isavailable, true),
    isFeatured: parseBoolean(row.isfeatured, false),
    sortOrder: toNumberOrNull(row.sortorder) ?? undefined,
  };
}

type BulkTab = "quick" | "spreadsheet";

export function ProductsBulkImport({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const bulk = useBulkCreateProducts();
  const exportProducts = useExportProducts();
  const [tab, setTab] = useState<BulkTab>("quick");
  const [mode, setMode] = useState<"create" | "upsert">("upsert");
  const [exportError, setExportError] = useState<string | null>(null);

  if (!open) return null;

  const runExport = async (format: "xlsx" | "csv") => {
    setExportError(null);
    try {
      const { rows } = await exportProducts.mutateAsync("all");
      await downloadSpreadsheet(
        rows as unknown as Record<string, unknown>[],
        `keyafe-products-${new Date().toISOString().slice(0, 10)}`,
        format,
      );
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "Export failed");
    }
  };

  const downloadTemplate = async () => {
    setExportError(null);
    try {
      await downloadSpreadsheet(
        [SAMPLE_TEMPLATE_ROW],
        "keyafe-products-import-template",
        "xlsx",
      );
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "Could not download template");
    }
  };

  return (
    <div className="mb-5 rounded-card border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Bulk upload</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Quick-add several products in the form, or import / export a spreadsheet.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center gap-1 self-start rounded-lg px-2 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-800"
        >
          <X className="h-3.5 w-3.5" />
          Close
        </button>
      </div>

      <div className="flex gap-1 border-b border-slate-100 px-4 pt-2">
        {(
          [
            { id: "quick" as const, label: "Quick add" },
            { id: "spreadsheet" as const, label: "Spreadsheet" },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "rounded-t-md px-3 py-2 text-xs font-medium transition",
              tab === t.id
                ? "border-b-2 border-brand-500 text-brand-800"
                : "text-slate-500 hover:text-slate-800",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="p-4">
        {tab === "quick" && <ProductsQuickBulkAdd />}

        {tab === "spreadsheet" && (
          <div className="space-y-3">
            <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Export / backup</h3>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Same columns as import — backup, edit offline, or use as the next upload
                    reference. Re-import with “Update existing slugs”.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void downloadTemplate()}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:border-brand-300 hover:text-brand-700"
                  >
                    Template
                  </button>
                  <button
                    type="button"
                    disabled={exportProducts.isPending}
                    onClick={() => void runExport("csv")}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:border-brand-300 hover:text-brand-700 disabled:opacity-50"
                  >
                    <Download className="h-3.5 w-3.5" />
                    {exportProducts.isPending ? "…" : "CSV"}
                  </button>
                  <button
                    type="button"
                    disabled={exportProducts.isPending}
                    onClick={() => void runExport("xlsx")}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-brand-300 bg-brand-50 px-3 py-2 text-xs font-medium text-brand-800 hover:bg-brand-100 disabled:opacity-50"
                  >
                    <Download className="h-3.5 w-3.5" />
                    {exportProducts.isPending ? "Exporting…" : "Excel backup"}
                  </button>
                </div>
              </div>
              {exportError && <p className="mt-2 text-xs text-red-700">{exportError}</p>}
            </div>

            <div className="flex flex-wrap items-center gap-3 px-1 text-xs text-slate-600">
              <span className="font-medium text-slate-700">On import:</span>
              <label className="inline-flex cursor-pointer items-center gap-1.5">
                <input
                  type="radio"
                  name="product-import-mode"
                  checked={mode === "upsert"}
                  onChange={() => setMode("upsert")}
                  className="text-brand-600"
                />
                Update existing slugs (backup restore)
              </label>
              <label className="inline-flex cursor-pointer items-center gap-1.5">
                <input
                  type="radio"
                  name="product-import-mode"
                  checked={mode === "create"}
                  onChange={() => setMode("create")}
                  className="text-brand-600"
                />
                Skip existing slugs (new only)
              </label>
            </div>

            <BulkSpreadsheetImport<BulkProductImportRow>
              className="mb-0"
              title="Import from file"
              description="Upload CSV, XLS, or XLSX. Categories must match existing category slugs. Images must be https URLs."
              columnsHint={COLUMNS_HINT}
              parseRow={parseProductImportRow}
              rowKey={(row, i) => `${row.slug ?? row.name}-${i}`}
              previewColumns={[
                {
                  id: "name",
                  header: "Name",
                  cell: (row) => (
                    <span className="font-medium text-slate-900">{row.name}</span>
                  ),
                },
                {
                  id: "categories",
                  header: "Categories",
                  cell: (row) => row.categorySlugs.join(", "),
                },
                {
                  id: "template",
                  header: "Template",
                  cell: (row) => row.template ?? "CAKE",
                },
                {
                  id: "price",
                  header: "Price",
                  align: "right",
                  cell: (row) => `₹${row.basePrice}`,
                },
              ]}
              onImport={async (rows) => {
                const result = await bulk.mutateAsync({ rows, mode });
                const errHint =
                  result.errors.length > 0
                    ? ` ${result.errors.length} issue(s): ${result.errors
                        .slice(0, 3)
                        .map((e) => `row ${e.row} ${e.message}`)
                        .join("; ")}${result.errors.length > 3 ? "…" : ""}`
                    : "";
                return `Created ${result.created}, updated ${result.updated}, skipped ${result.skipped}.${errHint}`;
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
