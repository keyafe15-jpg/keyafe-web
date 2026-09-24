/** Download tabular data as CSV or XLSX (browser). */

export async function downloadSpreadsheet(
  rows: Record<string, unknown>[],
  filenameBase: string,
  format: "xlsx" | "csv" = "xlsx",
): Promise<void> {
  const XLSX = await import("xlsx");
  const sheet = XLSX.utils.json_to_sheet(rows.length ? rows : [{}]);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Sheet1");
  const filename = `${filenameBase}.${format}`;
  if (format === "csv") {
    XLSX.writeFile(book, filename, { bookType: "csv" });
  } else {
    XLSX.writeFile(book, filename, { bookType: "xlsx" });
  }
}
