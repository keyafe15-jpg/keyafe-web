import { prisma } from "../../config/db.js";

const EXTRAS_SLUG = "extras";

async function ensureExtrasCategory() {
  const existing = await prisma.category.findUnique({ where: { slug: EXTRAS_SLUG } });
  if (existing) return existing;

  const dessert = await prisma.department.findUnique({
    where: { slug: "dessert" },
    select: { id: true },
  });
  return prisma.category.create({
    data: {
      slug: EXTRAS_SLUG,
      name: "Extras",
      description: "Candles, toppers, and other extras — add to any order.",
      isActive: true,
      sortOrder: 80,
      departmentId: dessert?.id,
    },
  });
}

async function uniqueProductSlug(desired: string, excludeProductId?: string | null) {
  const candidates = [desired, `addon-${desired}`];
  for (const slug of candidates) {
    const taken = await prisma.product.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!taken || taken.id === excludeProductId) return slug;
  }
  return `addon-${desired}-${Date.now().toString(36)}`;
}

/** Mirror an add-on as a shoppable OTHER product in the Extras category. */
export async function syncAddonShopProduct(addonId: string): Promise<string | null> {
  const addon = await prisma.addon.findUnique({
    where: { id: addonId },
    select: {
      id: true,
      slug: true,
      name: true,
      group: true,
      priceDelta: true,
      imageUrl: true,
      isActive: true,
      productId: true,
    },
  });
  if (!addon) return null;

  const extras = await ensureExtrasCategory();
  const slug = await uniqueProductSlug(addon.slug, addon.productId);
  const images = addon.imageUrl ? [addon.imageUrl] : [];
  const productData = {
    name: addon.name,
    slug,
    shortDescription: addon.group || null,
    template: "OTHER" as const,
    productType: "FIXED_VARIANTS" as const,
    basePrice: addon.priceDelta,
    images,
    isActive: addon.isActive,
    isAvailable: addon.isActive,
    isCustomizable: false,
    supportsMessageOnCake: false,
    supportsSameDayDelivery: true,
    canBeDeliveredPanIndia: false,
    gstRate: 5,
    hsnCode: "1905",
    priceIsGstInclusive: true,
    adminNotes: `addon-shop:${addon.id}`,
  };

  if (addon.productId) {
    await prisma.product.update({
      where: { id: addon.productId },
      data: {
        ...productData,
        categoryLinks: {
          deleteMany: { categoryId: { not: extras.id } },
          upsert: {
            where: {
              productId_categoryId: { productId: addon.productId, categoryId: extras.id },
            },
            create: { categoryId: extras.id },
            update: {},
          },
        },
      },
    });
    return slug;
  }

  const product = await prisma.product.create({
    data: {
      ...productData,
      categoryLinks: { create: { categoryId: extras.id } },
    },
    select: { id: true, slug: true },
  });
  await prisma.addon.update({
    where: { id: addon.id },
    data: { productId: product.id },
  });
  return product.slug;
}

export async function ensureAddonShopProducts(addonIds: string[]) {
  for (const id of addonIds) {
    await syncAddonShopProduct(id);
  }
}

/** Hide the shop listing when the add-on is deleted. */
export async function archiveAddonShopProduct(productId: string | null | undefined) {
  if (!productId) return;
  await prisma.product.update({
    where: { id: productId },
    data: { isActive: false, isAvailable: false, archivedAt: new Date() },
  });
}
