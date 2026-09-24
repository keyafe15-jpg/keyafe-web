/**
 * Shared spreadsheet (CSV / XLS / XLSX) helpers for admin bulk imports.
 * Domain pages supply a `parseRow` mapper; this layer only reads the file.
 */

/** Lowercase + strip non-alphanumerics so "Category Slugs" → "categoryslugs". */
export function normalizeHeaderKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function normalizeRowKeys(
  rawRow: Record<string, unknown>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(rawRow).map(([key, value]) => [normalizeHeaderKey(key), value]),
  );
}

/** Read first sheet as objects (header row required). */
export async function readSpreadsheetRows(
  file: File,
): Promise<Record<string, unknown>[]> {
  const XLSX = await import("xlsx");
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0] ?? ""];
  if (!sheet) return [];
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
  });
  return rawRows.map(normalizeRowKeys);
}

/**
 * Parse file → domain rows via `parseRow`.
 * Rows that return `null` are skipped (invalid).
 */
export async function parseSpreadsheetFile<T>(
  file: File,
  parseRow: (normalized: Record<string, unknown>) => T | null,
): Promise<T[]> {
  const rows = await readSpreadsheetRows(file);
  return rows.map(parseRow).filter((row): row is T => row !== null);
}

export function cellString(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

export function toNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value;
  const normalized = cellString(value).toLowerCase();
  if (["true", "yes", "y", "1"].includes(normalized)) return true;
  if (["false", "no", "n", "0"].includes(normalized)) return false;
  return fallback;
}

/** Split "a, b; c" → ["a","b","c"]. */
export function splitList(value: unknown): string[] {
  const raw = cellString(value);
  if (!raw) return [];
  return raw
    .split(/[,;|]/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export const SPREADSHEET_ACCEPT =
  ".csv,.xls,.xlsx,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
