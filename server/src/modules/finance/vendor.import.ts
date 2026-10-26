import { prisma } from "../../config/db.js";
import { gstinLooksLike, normalizeGstin } from "../../lib/gstin.js";
import { phoneLookupVariants } from "../../lib/phone.js";
import {
  cleanVendorAddress,
  cleanVendorPhone,
  fillVendorBlanks,
  findVendorByName,
} from "./purchase.service.js";
import { VENDOR_CHANNELS } from "./books.shared.js";

export type VendorImportRow = {
  name: string;
  phone?: string | null;
  channel?: "ONLINE" | "OFFLINE";
  gstin?: string | null;
  address?: string | null;
  supplies?: string[];
  notes?: string | null;
  upiId?: string | null;
  accountHint?: string | null;
};

export type VendorImportResult = {
  created: number;
  updated: number;
  skipped: number;
  errors: { name: string; message: string }[];
};

function blank(raw?: string | null): string | null {
  const t = raw?.trim() ?? "";
  return t || null;
}

function mergeSupplies(current: string[], incoming?: string[]) {
  if (!incoming?.length) return undefined;
  const next = [...current];
  for (const tag of incoming) {
    const t = tag.trim().toLowerCase().replace(/\s+/g, "-");
    if (t && !next.includes(t)) next.push(t);
  }
  return next.length === current.length ? undefined : next;
}

async function matchExisting(row: {
  name: string;
  gstin: string | null;
  phone: string | null;
}) {
  if (row.gstin) {
    const byGstin = await prisma.vendor.findFirst({
      where: { gstin: row.gstin },
      select: { id: true },
    });
    if (byGstin) return byGstin;
  }
  const byName = await findVendorByName(row.name);
  if (byName) return byName;
  if (row.phone) {
    return prisma.vendor.findFirst({
      where: { phone: { in: phoneLookupVariants(row.phone) } },
      select: { id: true },
    });
  }
  return null;
}

export async function importVendors(rows: VendorImportRow[]): Promise<VendorImportResult> {
  const result: VendorImportResult = { created: 0, updated: 0, skipped: 0, errors: [] };
  const seen = new Set<string>();

  for (const raw of rows) {
    const name = raw.name.trim();
    if (!name) {
      result.skipped += 1;
      continue;
    }
    const key = name.toLowerCase();
    if (seen.has(key)) {
      result.skipped += 1;
      continue;
    }
    seen.add(key);

    const gstinRaw = blank(raw.gstin);
    const gstin = gstinRaw ? normalizeGstin(gstinRaw) : null;
    if (gstin && !gstinLooksLike(gstin)) {
      result.errors.push({ name, message: "GSTIN does not look valid" });
      continue;
    }
    const phone = cleanVendorPhone(raw.phone);
    const address = cleanVendorAddress(raw.address);
    const notes = blank(raw.notes)?.slice(0, 2000) ?? null;
    const upiId = blank(raw.upiId)?.slice(0, 120) ?? null;
    const accountHint = blank(raw.accountHint)?.slice(0, 160) ?? null;
    const channel =
      raw.channel && (VENDOR_CHANNELS as readonly string[]).includes(raw.channel)
        ? raw.channel
        : undefined;
    const supplies = (raw.supplies ?? [])
      .map((s) => s.trim().toLowerCase().replace(/\s+/g, "-"))
      .filter(Boolean)
      .slice(0, 20);

    try {
      const existing = await matchExisting({ name, gstin, phone });
      if (existing) {
        await fillVendorBlanks(existing.id, { gstin, phone, address });
        const current = await prisma.vendor.findUnique({
          where: { id: existing.id },
          select: { notes: true, upiId: true, accountHint: true, supplies: true },
        });
        if (!current) continue;
        const nextSupplies = mergeSupplies(current.supplies, supplies);
        await prisma.vendor.update({
          where: { id: existing.id },
          data: {
            ...(channel ? { channel } : {}),
            ...(notes && !current.notes?.trim() ? { notes } : {}),
            ...(upiId && !current.upiId?.trim() ? { upiId } : {}),
            ...(accountHint && !current.accountHint?.trim() ? { accountHint } : {}),
            ...(nextSupplies ? { supplies: nextSupplies } : {}),
          },
        });
        result.updated += 1;
        continue;
      }
      await prisma.vendor.create({
        data: {
          name: name.slice(0, 160),
          phone,
          channel: channel ?? "OFFLINE",
          gstin,
          address,
          notes,
          upiId,
          accountHint,
          supplies,
        },
      });
      result.created += 1;
    } catch (err) {
      result.errors.push({
        name,
        message: err instanceof Error ? err.message : "Could not import",
      });
    }
  }

  return result;
}
