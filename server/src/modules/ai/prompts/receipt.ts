export type ReceiptParseKind = "BUY" | "EXPENSE";

export type ReceiptCatalog = {
  vendors: { name: string; channel: string }[];
  items: { name: string; unit: string; packSize: number | null }[];
  categories: { slug: string; name: string }[];
};

export function buildReceiptPrompt(
  kind: ReceiptParseKind,
  catalog: ReceiptCatalog,
  context?: string | null,
): string {
  const vendors = catalog.vendors.map((v) => `${v.name} (${v.channel})`).join(", ") || "(none yet)";
  const items =
    catalog.items
      .map((i) => (i.packSize && i.packSize > 1 ? `${i.name} [${i.packSize}-pc ${i.unit}]` : `${i.name} [${i.unit}]`))
      .join(", ") || "(none yet)";
  const categories = catalog.categories.map((c) => `${c.slug} = ${c.name}`).join(", ") || "(none)";
  const hint = context?.trim();

  return [
    "You read bakery shop bills for Keyafe (Kolkata). Extract a JSON object. No markdown.",
    "The photo may be a typed invoice/screenshot OR a handwritten kirana/market slip (English, Hindi, or Bangla numerals). Read print and handwriting.",
    "Prefer a catalog name when the writing is close. If a line is unreadable, omit it — do not invent qty or rate. Set uncertain=true when anything is guessed or skipped.",
    hint
      ? `Staff note (use to disambiguate; do not invent extra lines from it): ${hint}`
      : "No extra staff note.",
    "Known vendors: " + vendors,
    "Known items: " + items,
    "Expense categories (use slug): " + categories,
    "Return JSON with:",
    '- "vendor": shop/seller name or null',
    '- "vendorGstin": ALWAYS copy the SELLER / Dist / From GSTIN (15 characters) when printed — even if the bill has ₹0 GST, "GST not included", composition, or no tax table. Never Keyafe / buyer / bill-to GSTIN. Labels: GSTIN, GST No, GSTIN No, GST. Strip spaces. Null only if that number is not on the bill.',
    '- "vendorPhone": SELLER / shop / Dist phone only (not buyer / Keyafe / billed-to). Digits. Null if not printed.',
    '- "vendorAddress": SELLER / shop / Dist / From address only (not bill-to / ship-to Keyafe). One line, as printed. Null if not printed.',
    '- "vendorChannel": "ONLINE" if website/app/marketplace, else "OFFLINE"',
    '- "date": bill date as YYYY-MM-DD (IST) or null',
    '- "paymentMethod": "CASH" | "UPI" | "BANK" or null',
    '- "category": category slug from the list, or a close name',
    '- "shipping": delivery/courier/Delhivery/shipping amount as a number (0 if none). Never a line item.',
    '- "miscCharges": SUM of every other extra fee (handling, packing charge, convenience, platform, service, processing, surcharge). Different bills use different names — put them all here, never as lines.',
    '- "cgst": CGST amount from the tax summary (number, 0 if none). Not a line item.',
    '- "sgst": SGST amount from the tax summary (number, 0 if none). Not a line item.',
    '- "igst": IGST amount if interstate (number, 0 if none). Not a line item.',
    '- "gst": total GST only when CGST/SGST/IGST are not printed separately; else 0. Tax amounts being 0 does not mean vendorGstin is null.',
    '- "amount": grand total / receivable (what was paid). Includes GST.',
    '- "notes": short note or null',
    '- "lines": array of { "name", "qty", "unit", "packSize", "unitPrice" }',
    '  unit is KG | L | PCS | PACKET. packSize is pieces per pack or null. qty is packs when packSize > 1, else the sold qty.',
    '  unitPrice is what was paid per unit INCLUDING GST (Amount ÷ qty, or the Net/incl. column). Never MRP. Never the exclusive Rate column when Amount or Net is printed.',
    "Read the TAX SUMMARY box (CGST 2.5% + SGST 2.5%, IGST, taxable). Sum the GST amounts across rates. A 5% GST line is usually 2.5% CGST + 2.5% SGST.",
    '- "looksLikeBuy": true when this is a shop invoice with item lines, false for rent/salary/ads/gas/one-lump fees',
    '- "uncertain": true if handwriting was unclear or lines were skipped',
    kind === "BUY"
      ? "This staff is logging a shop buy. Fill goods lines only. Shipping and miscellaneous charges are fields, not lines."
      : "This staff is logging a loose expense. Prefer amount + category. Still fill lines if it is clearly a goods invoice and set looksLikeBuy true.",
  ].join("\n");
}
