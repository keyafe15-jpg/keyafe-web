// Shared look and primitives for the printable order documents — the tax
// invoice and the delivery challan. Keeping them here means the two never
// drift apart on page size, palette or date formatting.
import { readFileSync } from "node:fs";
import path from "node:path";
import { logger } from "../../utils/logger.js";

// A4 at 72dpi, with a margin that leaves room for the footer declaration.
export const PAGE = { size: "A4" as const, margin: 40 };
export const LOGO_BOX = 64;
export const INK = "#2c3540";
export const MUTED = "#7d8590";
export const RULE = "#d8d2c4";
export const ACCENT = "#e31c79";

export type Doc = PDFKit.PDFDocument;

// Rupee glyph is missing from PDF's built-in Helvetica, so amounts are printed
// with "Rs." rather than a box. Embedding a Unicode font would be the fix if a
// rupee sign is ever required.
export function money(v: number): string {
  const sign = v < 0 ? "-" : "";
  return `${sign}Rs. ${Math.abs(v).toFixed(2)}`;
}

export function formatDate(d: Date): string {
  return d.toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// The logo lives outside src/ because `tsc` doesn't copy assets into dist/.
// src/modules/orders and dist/modules/orders sit at the same depth under the
// package root, so one relative path resolves correctly in dev and in prod.
export const LOGO_PATH = path.resolve(
  import.meta.dirname,
  "../../../assets/invoice-logo.png",
);

// `undefined` means "not looked up yet", `null` means "looked up and absent".
let logoCache: Buffer | null | undefined;

/** Reads the masthead logo once. Returns null rather than throwing, so a
 *  missing or unreadable file degrades to the text masthead instead of
 *  failing every document download. */
export function brandLogo(): Buffer | null {
  if (logoCache !== undefined) return logoCache;
  try {
    logoCache = readFileSync(LOGO_PATH);
  } catch (err) {
    logoCache = null;
    logger.warn(
      { err, path: LOGO_PATH },
      "brand logo not found — falling back to the trade name in the masthead",
    );
  }
  return logoCache;
}

/** Either side of a document: the seller, the billed party or the consignee. */
export interface DocumentParty {
  name: string;
  legalName?: string;
  gstin?: string | null;
  addressLines: string[];
  stateName?: string | null;
  stateCode?: string | null;
  phone?: string | null;
  email?: string | null;
}

/** Renders one party's details as a block, advancing `doc.y` past it. */
export function partyBlock(
  doc: Doc,
  party: DocumentParty,
  x: number,
  width: number,
) {
  doc.fillColor(INK).fontSize(9.5).font("Helvetica-Bold");
  doc.text(party.name, x, doc.y, { width });
  doc.font("Helvetica").fillColor(MUTED).fontSize(8.5);

  if (party.legalName && party.legalName !== party.name) {
    doc.text(party.legalName, x, doc.y, { width });
  }
  for (const line of party.addressLines) {
    doc.text(line, x, doc.y, { width });
  }
  if (party.stateName) {
    doc.text(`${party.stateName} (${party.stateCode})`, x, doc.y, { width });
  }
  if (party.phone) doc.text(party.phone, x, doc.y, { width });
  if (party.email) doc.text(party.email, x, doc.y, { width });
  if (party.gstin) {
    doc.font("Helvetica-Bold").fillColor(INK);
    doc.text(`GSTIN: ${party.gstin}`, x, doc.y + 2, { width });
  }
}
