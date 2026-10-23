import { prisma } from "../../config/db.js";
import { logger } from "../../utils/logger.js";
import { parseDateKey } from "./books.shared.js";
import { createPurchase, resolveBuyItem, resolveCategory, resolveVendor } from "./purchase.service.js";

/** Real Arife Aesthetics box orders from Oct 2026 (screenshots). */
const ARIFE_BUYS: {
  orderNumber: string;
  date: string;
  paymentMethod: "UPI" | "BANK" | "CASH";
  notes: string;
  shipping: number;
  lines: {
    name: string;
    unit: "PACKET" | "PCS";
    packSize?: number;
    qty: number;
    unitPrice: number;
  }[];
}[] = [
  {
    orderNumber: "53934",
    date: "2026-10-14",
    paymentMethod: "UPI",
    notes: "Arife Aesthetics order #53934 · delivered 20 Oct · Delhivery 522425100693220",
    shipping: 180,
    lines: [
      { name: "Rakhi sample hamper box", unit: "PACKET", packSize: 10, qty: 1, unitPrice: 599 },
      { name: "Brownie L-shape window box black", unit: "PACKET", packSize: 10, qty: 1, unitPrice: 675 },
      { name: "Heart handle hamper box mint green", unit: "PACKET", packSize: 10, qty: 2, unitPrice: 300 },
    ],
  },
  {
    orderNumber: "54139",
    date: "2026-10-16",
    paymentMethod: "UPI",
    notes: "Arife Aesthetics order #54139 · Delhivery 522425100771866",
    shipping: 150,
    lines: [
      { name: "Cake box transparent with handle 6x6", unit: "PACKET", packSize: 10, qty: 1, unitPrice: 499 },
      { name: "4-in-1 brownie/cookie box gold", unit: "PACKET", packSize: 10, qty: 1, unitPrice: 180 },
      { name: "Brownie L-shape window box pink", unit: "PACKET", packSize: 10, qty: 1, unitPrice: 199 },
    ],
  },
];

async function staffUserId() {
  const staff = await prisma.user.findFirst({
    where: { role: { slug: { not: "customer" } } },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  return staff?.id ?? null;
}

export async function seedArifePurchases() {
  const createdByUserId = await staffUserId();
  if (!createdByUserId) {
    logger.warn("Arife buy seed: no staff user — skipped");
    return;
  }
  await prisma.expenseCategory.upsert({
    where: { slug: "packaging" },
    create: { slug: "packaging", name: "Packaging", sortOrder: 1 },
    update: {},
  });
  const category = await resolveCategory("packaging");
  const existingVendor = await prisma.vendor.findFirst({
    where: { name: { equals: "Arife Aesthetics", mode: "insensitive" } },
    select: { id: true },
  });
  const vendorId =
    existingVendor?.id ??
    (await resolveVendor({ name: "Arife Aesthetics", channel: "ONLINE" }));
  await prisma.vendor.update({
    where: { id: vendorId },
    data: {
      channel: "ONLINE",
      supplies: ["boxes", "packaging"],
      notes: "arife.in — cake / hamper / brownie boxes",
    },
  });

  let added = 0;
  let skipped = 0;
  for (const buy of ARIFE_BUYS) {
    for (const line of buy.lines) {
      await resolveBuyItem({
        name: line.name,
        unit: line.unit,
        packSize: line.packSize,
      });
    }
    const already = await prisma.purchase.findFirst({
      where: { notes: { contains: `order #${buy.orderNumber}` } },
      select: { id: true },
    });
    if (already) {
      skipped += 1;
      continue;
    }
    const lines = [];
    for (const line of buy.lines) {
      const item = await resolveBuyItem({
        name: line.name,
        unit: line.unit,
        packSize: line.packSize,
      });
      lines.push({
        buyItemId: item.id,
        qty: line.qty,
        unitPrice: line.unitPrice,
      });
    }
    await createPurchase({
      date: parseDateKey(buy.date),
      vendorId,
      purpose: "PRODUCTION",
      paymentMethod: buy.paymentMethod,
      notes: buy.notes,
      shipping: buy.shipping,
      categoryId: category.id,
      createdByUserId,
      lines,
    });
    added += 1;
  }
  logger.info(`Arife buys seed: ${added} added, ${skipped} already present`);
}
