import { useState, type ReactNode } from "react";
import { FileSpreadsheet, Upload } from "lucide-react";
import {
  parseSpreadsheetFile,
  SPREADSHEET_ACCEPT,
} from "@/lib/spreadsheetImport";
import { cn } from "@/lib/cn";
import { submitClass } from "@/components/form/Field";

export type BulkPreviewColumn<T> = {
  id: string;
  header: string;
  cell: (row: T) => ReactNode;
  align?: "left" | "right";
};

type Props<T> = {
  title: string;
  description: ReactNode;
  /** Shown under the title — expected column names. */
  columnsHint: string;
  parseRow: (normalized: Record<string, unknown>) => T | null;
  previewColumns: BulkPreviewColumn<T>[];
  /** Called with valid rows; return a success message string. */
  onImport: (rows: T[]) => Promise<string>;
  rowKey: (row: T, index: number) => string;
  maxPreview?: number;
  emptyFileMessage?: string;
  className?: string;
};

/**
 * Generic CSV/XLS/XLSX picker → parse → preview → import.
 * Domain pages only supply parseRow + onImport + preview columns.
 */
export function BulkSpreadsheetImport<T>({
  title,
  description,
  columnsHint,
  parseRow,
  previewColumns,
  onImport,
  rowKey,
  maxPreview = 5,
  emptyFileMessage = "No valid rows found in this file.",
  className,
}: Props<T>) {
  const [rows, setRows] = useState<T[]>([]);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const onFileChange = async (file: File | undefined) => {
    setError(null);
    setResult(null);
    setRows([]);
    setFileName(file?.name ?? "");
    if (!file) return;

    try {
      const parsed = await parseSpreadsheetFile(file, parseRow);
      if (parsed.length === 0) {
        setError(emptyFileMessage);
        return;
      }
      setRows(parsed);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to read file");
    }
  };

  const submit = async () => {
    setError(null);
    setResult(null);
    setPending(true);
    try {
      const message = await onImport(rows);
      setResult(message);
      setRows([]);
      setFileName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setPending(false);
    }
  };

  return (
    <div
      className={cn(
        "mb-5 rounded-card border border-dashed border-brand-300 bg-brand-50/40 p-4",
        className,
      )}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-2xl">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <FileSpreadsheet className="h-4 w-4 text-brand-500" />
            {title}
          </div>
          <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
          <p className="mt-1 text-[11px] leading-4 text-slate-400">
            Expected columns: {columnsHint}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-brand-300 hover:text-brand-500">
            <Upload className="h-4 w-4" /> Choose file
            <input
              type="file"
              accept={SPREADSHEET_ACCEPT}
              onChange={(event) => void onFileChange(event.target.files?.[0])}
              className="sr-only"
            />
          </label>
          <button
            type="button"
            disabled={rows.length === 0 || pending}
            onClick={() => void submit()}
            className={cn(submitClass, "inline-flex items-center gap-1.5")}
          >
            {pending ? "Importing…" : `Import ${rows.length > 0 ? rows.length : ""}`}
          </button>
        </div>
      </div>

      {fileName && (
        <p className="mt-3 text-xs text-slate-600">
          Selected: <span className="font-medium text-slate-900">{fileName}</span>
        </p>
      )}

      {rows.length > 0 && (
        <div className="mt-3 overflow-hidden rounded-lg border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-3 py-2 text-xs font-medium text-slate-500">
            Previewing first {Math.min(rows.length, maxPreview)} of {rows.length} valid rows
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-xs">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  {previewColumns.map((col) => (
                    <th
                      key={col.id}
                      className={cn(
                        "px-3 py-2 font-medium",
                        col.align === "right" && "text-right",
                      )}
                    >
                      {col.header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.slice(0, maxPreview).map((row, index) => (
                  <tr key={rowKey(row, index)}>
                    {previewColumns.map((col) => (
                      <td
                        key={col.id}
                        className={cn(
                          "px-3 py-2 text-slate-700",
                          col.align === "right" && "text-right tabular-nums",
                        )}
                      >
                        {col.cell(row)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {result && (
        <p className="mt-3 rounded-md bg-emerald-50 px-3 py-2 text-xs text-emerald-700">{result}</p>
      )}
      {error && (
        <p className="mt-3 whitespace-pre-wrap rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
