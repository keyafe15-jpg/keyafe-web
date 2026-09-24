import { useMemo, useState } from "react";
import { Download, FileSpreadsheet, FileText } from "lucide-react";
import { useDownloadGstExport } from "@/hooks/useAdminOrders";
import { useStaffPermission } from "@/lib/permissions";
import { cn } from "@/lib/cn";

function fyLabelForDate(d: Date): string {
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const start = m >= 4 ? y : y - 1;
  const two = (n: number) => String(n % 100).padStart(2, "0");
  return `${two(start)}-${two(start + 1)}`;
}

function fyOptions(count = 4): string[] {
  const current = fyLabelForDate(new Date());
  const startYear = 2000 + Number(current.slice(0, 2));
  const two = (n: number) => String(n % 100).padStart(2, "0");
  return Array.from({ length: count }, (_, i) => {
    const s = startYear - i;
    return `${two(s)}-${two(s + 1)}`;
  });
}

/**
 * Download a GST invoice register (Excel or PDF) for a date range or FY.
 * Visible only to staff with invoices.read.
 */
export function GstExportPanel() {
  const canReadInvoices = useStaffPermission("invoices.read");
  const download = useDownloadGstExport();
  const [mode, setMode] = useState<"range" | "fy">("fy");
  const fys = useMemo(() => fyOptions(4), []);
  const [fy, setFy] = useState(fys[0]!);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!canReadInvoices) return null;

  const rangeInvalid = !!(from && to && from > to);
  const canSubmit =
    mode === "fy"
      ? !!fy
      : !!from && !!to && !rangeInvalid;

  const run = async (format: "xlsx" | "pdf") => {
    setError(null);
    if (!canSubmit) {
      setError(mode === "fy" ? "Pick a financial year." : "Pick a valid from/to date.");
      return;
    }
    try {
      await download.mutateAsync(
        mode === "fy"
          ? { mode: "fy", fy, format }
          : { mode: "range", from, to, format },
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    }
  };

  return (
    <div className="mb-5 rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">GST export</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Invoice register for your CA — Excel (full) or PDF (summary). By invoice date;
            cash/COD sales are excluded. Missing numbers on other paid orders are issued for
            the period.
          </p>
        </div>

        <div className="flex shrink-0 gap-1 rounded-md border border-slate-200 p-0.5">
          <button
            type="button"
            onClick={() => setMode("fy")}
            className={cn(
              "rounded px-2.5 py-1 text-[11px] font-medium",
              mode === "fy" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-50",
            )}
          >
            Financial year
          </button>
          <button
            type="button"
            onClick={() => setMode("range")}
            className={cn(
              "rounded px-2.5 py-1 text-[11px] font-medium",
              mode === "range" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-50",
            )}
          >
            Date range
          </button>
        </div>
      </div>

      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        {mode === "fy" ? (
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-medium text-slate-600">FY (Apr–Mar)</span>
            <select
              value={fy}
              onChange={(e) => setFy(e.target.value)}
              className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none"
            >
              {fys.map((label) => (
                <option key={label} value={label}>
                  FY {label}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-medium text-slate-600">From</span>
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                max={to || undefined}
                className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none"
              />
            </label>
            <span className="pb-2 text-xs text-slate-400">→</span>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-medium text-slate-600">To</span>
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                min={from || undefined}
                className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none"
              />
            </label>
          </div>
        )}

        <div className="flex flex-wrap gap-2 sm:ml-auto">
          <button
            type="button"
            disabled={!canSubmit || download.isPending}
            onClick={() => void run("xlsx")}
            className="inline-flex items-center gap-1.5 rounded-md bg-brand-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-600 disabled:opacity-50"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            {download.isPending ? "Preparing…" : "Download Excel"}
          </button>
          <button
            type="button"
            disabled={!canSubmit || download.isPending}
            onClick={() => void run("pdf")}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-brand-500 hover:text-brand-700 disabled:opacity-50"
          >
            <FileText className="h-3.5 w-3.5" />
            PDF summary
          </button>
        </div>
      </div>

      {(error || rangeInvalid) && (
        <p className="mt-2 text-[11px] text-brand-700">
          {rangeInvalid ? '"From" must be on or before "To".' : error}
        </p>
      )}

      {download.isSuccess && download.data && !download.isPending && !error && (
        <p className="mt-2 flex items-center gap-1 text-[11px] text-slate-500">
          <Download className="h-3 w-3" />
          Downloaded {download.data.period}
          {download.data.count != null ? ` · ${download.data.count} invoice(s)` : ""}
        </p>
      )}
    </div>
  );
}
