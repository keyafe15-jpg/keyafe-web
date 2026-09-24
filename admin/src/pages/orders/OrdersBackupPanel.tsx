import { useRef, useState } from "react";
import { Download, FileSpreadsheet, Upload } from "lucide-react";
import {
  useDownloadOrdersBackup,
  useImportOrdersBackup,
} from "@/hooks/useAdminOrders";
import { useStaffPermission } from "@/lib/permissions";

function toInputDate(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const today = new Date();
const defaultMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);

/**
 * Download a full orders backup and reimport it after data loss.
 * Export: orders.read · Import: orders.update
 */
export function OrdersBackupPanel() {
  const canRead = useStaffPermission("orders.read");
  const canImport = useStaffPermission("orders.update");
  const download = useDownloadOrdersBackup();
  const importBackup = useImportOrdersBackup();
  const fileRef = useRef<HTMLInputElement>(null);
  const [from, setFrom] = useState(toInputDate(defaultMonthStart));
  const [to, setTo] = useState(toInputDate(today));
  const [allTime, setAllTime] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  if (!canRead) return null;

  const rangeInvalid = !allTime && !!(from && to && from > to);
  const canDownload = allTime || (!!from && !!to && !rangeInvalid);

  const runDownload = async (format: "xlsx" | "csv") => {
    setError(null);
    setResult(null);
    if (!canDownload) {
      setError("Pick a valid from/to date, or choose All time.");
      return;
    }
    try {
      const data = await download.mutateAsync(
        allTime ? { format } : { format, from, to },
      );
      setResult(
        `Downloaded ${data.orderCount ?? "?"} order(s), ${data.itemCount ?? "?"} line item(s)` +
          (data.period ? ` · ${data.period === "all" ? "all time" : data.period}` : "") +
          ".",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Download failed");
    }
  };

  const onFile = async (file: File | undefined) => {
    if (!file || !canImport) return;
    setError(null);
    setResult(null);
    try {
      const data = await importBackup.mutateAsync(file);
      const parts = [
        `Created ${data.created}`,
        `updated ${data.updated}`,
        `${data.itemCount} line item(s)`,
      ];
      if (data.skipped > 0) parts.push(`${data.skipped} skipped`);
      setResult(parts.join(" · "));
      if (data.errors.length > 0) {
        setError(data.errors.slice(0, 5).join(" · "));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const busy = download.isPending || importBackup.isPending;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div>
        <h2 className="text-sm font-semibold text-slate-900">Orders backup</h2>
        <p className="mt-0.5 text-xs text-slate-500">
          Download orders for safekeeping (by order date). Reimport the same XLSX or CSV after a
          data loss — upserts by order number and restores line items. Coupon redemptions and
          offline links are not included.
        </p>
      </div>

      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-medium text-slate-600">From</span>
            <input
              type="date"
              value={from}
              disabled={allTime}
              onChange={(e) => {
                setFrom(e.target.value);
                setAllTime(false);
              }}
              max={to || undefined}
              className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 disabled:bg-slate-50 disabled:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none"
            />
          </label>
          <span className="pb-2 text-xs text-slate-400">→</span>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-medium text-slate-600">To</span>
            <input
              type="date"
              value={to}
              disabled={allTime}
              onChange={(e) => {
                setTo(e.target.value);
                setAllTime(false);
              }}
              min={from || undefined}
              className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 disabled:bg-slate-50 disabled:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none"
            />
          </label>
          <button
            type="button"
            onClick={() => setAllTime((v) => !v)}
            className={
              allTime
                ? "rounded-md bg-slate-900 px-2.5 py-1.5 text-[11px] font-medium text-white"
                : "rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-slate-600 hover:border-brand-500 hover:text-brand-700"
            }
          >
            All time
          </button>
        </div>

        <div className="flex flex-wrap gap-2 sm:ml-auto">
          <button
            type="button"
            disabled={!canDownload || busy}
            onClick={() => void runDownload("xlsx")}
            className="inline-flex items-center gap-1.5 rounded-md bg-brand-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-600 disabled:opacity-50"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            {download.isPending ? "Preparing…" : "Download Excel"}
          </button>
          <button
            type="button"
            disabled={!canDownload || busy}
            onClick={() => void runDownload("csv")}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-brand-500 hover:text-brand-700 disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" />
            Download CSV
          </button>

          {canImport && (
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-dashed border-slate-300 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-brand-500 hover:text-brand-700">
              <Upload className="h-3.5 w-3.5" />
              {importBackup.isPending ? "Importing…" : "Reimport backup"}
              <input
                ref={fileRef}
                type="file"
                accept=".csv,.xls,.xlsx,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                disabled={busy}
                className="sr-only"
                onChange={(e) => void onFile(e.target.files?.[0])}
              />
            </label>
          )}
        </div>
      </div>

      {rangeInvalid && (
        <p className="mt-2 text-[11px] text-brand-700">"From" must be on or before "To".</p>
      )}
      {result && <p className="mt-2 text-[11px] text-emerald-700">{result}</p>}
      {error && <p className="mt-2 text-[11px] text-brand-700">{error}</p>}
    </div>
  );
}
