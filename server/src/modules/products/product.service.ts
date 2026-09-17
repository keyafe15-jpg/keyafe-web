import { z } from "zod";
import { prisma } from "../../config/db.js";
import { HttpError } from "../../utils/httpError.js";

const optionSchema = z.object({
  key: z.string().trim().min(1),
  label: z.string().trim().min(1),
  price: z.coerce.number().default(0),
  weightGrams: z.coerce.number().int().positive().nullable().optional(),
  diameterMm: z.coerce.number().int().positive().nullable().optional(),
  isDefault: z.boolean().default(false),
  isActive: z.boolean().default(true),
  sortOrder: z.coerce.number().int().default(0),
});

export const createProductSchema = z.object({
  name: z.string().trim().min(2, "Name is required"),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9-]+$/, "Lowercase letters, digits, hyphens only"),
  shortDescription: z.string().trim().max(300).optional().nullable(),
  description: z.string().trim().optional().nullable(),

  categoryIds: z.array(z.string().min(1)).min(1, "Pick at least one category"),

  images: z.array(z.string().url()).max(10),

  basePrice: z.coerce.number().nonnegative(),
  productType: z.enum(["FIXED_VARIANTS", "CONFIGURABLE"]).default("CONFIGURABLE"),
  template: z.enum(["CAKE", "PIZZA", "OTHER"]).default("CAKE"),
  isCustomizable: z.boolean().default(false),
  isEggless: z.boolean().default(true),
  sellByPound: z.boolean().default(false),
  minGrams: z.coerce.number().int().positive().nullable().optional(),
  maxGrams: z.coerce.number().int().positive().nullable().optional(),
  allowCustomSize: z.boolean().default(false),

  supportsMessageOnCake: z.boolean().default(false),
  messageMaxLength: z.coerce.number().int().positive().default(40),
  supportsSameDayDelivery: z.boolean().default(false),
  leadTimeHours: z.coerce.number().int().nonnegative().default(0),
  canBeDeliveredPanIndia: z.boolean().default(false),
  isHealthyTreat: z.boolean().default(false),

  gstRate: z.coerce.number().min(0).max(28).default(5),
  hsnCode: z.string().trim().default("1905"),
  priceIsGstInclusive: z.boolean().default(true),

  allergens: z.array(z.string().trim()).default([]),
  metaTitle: z.string().trim().max(70).optional().nullable(),
  metaDescription: z.string().trim().max(160).optional().nullable(),
  adminNotes: z.string().trim().optional().nullable(),
  kitchenNotes: z.string().trim().optional().nullable(),

  isActive: z.boolean().default(true),
  isAvailable: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
  sortOrder: z.coerce.number().int().default(0),

  flavorIds: z.array(z.string()).default([]),
  tagIds: z.array(z.string()).default([]),

  // Pizza-specific inputs. Optional so cake payloads don't have to send them.
  sizeOptions: z.array(optionSchema).optional(),
  crustOptions: z.array(optionSchema).optional(),
  toppingIds: z.array(z.string()).optional(),
  addonIds: z.array(z.string()).optional(),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;

/** Storefront only shows active products that are in stock. */
const PUBLIC_LIST_WHERE = {
  isActive: true,
  isAvailable: true,
} as const;

const ADMIN_LIST_SELECT = {
  id: true,
  slug: true,
  name: true,
  basePrice: true,
  productType: true,
  template: true,
  isActive: true,
  isAvailable: true,
  isFeatured: true,
  images: true,
  createdAt: true,
  categoryLinks: {
    select: { category: { select: { id: true, name: true, slug: true } } },
  },
  // Size group drives variant pricing (e.g. pizzas priced per-size with
  // basePrice = 0). Admin list needs the resulting price range, not the
  // raw basePrice, which can be misleadingly 0.
  optionGroups: {
    where: { key: "size" },
    select: {
      priceMode: true,
      options: {
        where: { isActive: true },
        select: { price: true },
      },
    },
  },
} as const;

function decorateAdminListRow<
  T extends {
    basePrice: unknown;
    categoryLinks: { category: { id: string; name: string; slug: string } }[];
    optionGroups: {
      priceMode: "ABSOLUTE" | "DELTA";
      options: { price: unknown }[];
    }[];
  },
>(row: T) {
  const { optionGroups, categoryLinks, ...rest } = row;
  const base = Number(rest.basePrice);
  const sizeGroup = optionGroups[0];
  const categories = categoryLinks.map((l) => l.category);
  if (!sizeGroup || sizeGroup.options.length === 0) {
    return { ...rest, categories, priceMin: base, priceMax: base };
  }
  const prices = sizeGroup.options.map((o) => Number(o.price));
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const priceMin = sizeGroup.priceMode === "ABSOLUTE" ? min : base + min;
  const priceMax = sizeGroup.priceMode === "ABSOLUTE" ? max : base + max;
  return { ...rest, categories, priceMin, priceMax };
}

function buildAdminProductSearchWhere(search?: string) {
  const q = search?.trim();
  if (!q) return {};
  return {
    OR: [
      { name: { contains: q, mode: "insensitive" as const } },
      { slug: { contains: q, mode: "insensitive" as const } },
      {
        categoryLinks: {
          some: {
            category: { name: { contains: q, mode: "insensitive" as const } },
          },
        },
      },
    ],
  };
}

export async function listProducts(page = 1, pageSize = 20, search?: string) {
  const safePage = Math.max(1, Number(page) || 1);
  const safePageSize = Math.min(100, Math.max(1, Number(pageSize) || 20));
  const skip = (safePage - 1) * safePageSize;
  const where = buildAdminProductSearchWhere(search);

  const [total, products] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      orderBy: [{ createdAt: "desc" }],
      skip,
      take: safePageSize,
      select: ADMIN_LIST_SELECT,
    }),
  ]);

  const items = products.map((p) => decorateAdminListRow(p));
  const totalPages = Math.max(1, Math.ceil(total / safePageSize));

  return {
    items,
    page: safePage,
    pageSize: safePageSize,
    total,
    totalPages,
  };
}

const PUBLIC_CARD_SELECT = {
  id: true,
  slug: true,
  name: true,
  shortDescription: true,
  basePrice: true,
  template: true,
  images: true,
  isAvailable: true,
  isFeatured: true,
  leadTimeHours: true,
  supportsSameDayDelivery: true,
  canBeDeliveredPanIndia: true,
  isHealthyTreat: true,
  categoryLinks: {
    select: { category: { select: { id: true, slug: true, name: true } } },
  },
  tags: {
    select: { id: true, slug: true, name: true, colorHex: true },
    orderBy: { name: "asc" as const },
  },
  // Read the size group's options so we can surface a "starts from" price
  // for variant-priced products (pizzas, etc.) where basePrice = 0.
  optionGroups: {
    where: { key: "size" },
    select: {
      priceMode: true,
      options: {
        where: { isActive: true },
        select: { price: true },
      },
    },
  },
} as const;

type PublicCardRow = {
  id: string;
  slug: string;
  name: string;
  shortDescription: string | null;
  basePrice: unknown;
  template: "CAKE" | "PIZZA" | "OTHER";
  images: string[];
  isAvailable: boolean;
  isFeatured: boolean;
  leadTimeHours: number;
  supportsSameDayDelivery: boolean;
  canBeDeliveredPanIndia: boolean;
  isHealthyTreat: boolean;
  categoryLinks: {
    category: { id: string; slug: string; name: string };
  }[];
  tags: {
    id: string;
    slug: string;
    name: string;
    colorHex: string | null;
  }[];
  optionGroups: {
    priceMode: "ABSOLUTE" | "DELTA";
    options: { price: unknown }[];
  }[];
};

// Adds a `startingPrice` string (min customer-visible price) for the card,
// derived from the size group when priced by variant.
function decorateCard(row: PublicCardRow) {
  const base = Number(row.basePrice);
  const sizeGroup = row.optionGroups[0];
  let startingPrice = base;
  if (sizeGroup && sizeGroup.options.length > 0) {
    const prices = sizeGroup.options.map((o) => Number(o.price));
    const min = Math.min(...prices);
    startingPrice = sizeGroup.priceMode === "ABSOLUTE" ? min : base + min;
  }
  const { optionGroups: _drop, categoryLinks, ...rest } = row;
  return {
    ...rest,
    categories: categoryLinks.map((l) => l.category),
    startingPrice: startingPrice.toFixed(2),
  };
}

// Returns products for a category slug. If the slug is a top-level
// category, includes products from all its children so shoppers see
// everything under "Celebration Cakes" without picking a sub yet.
export async function listPublicProductsByCategorySlug(slug: string, page = 1, pageSize = 12) {
  const category = await prisma.category.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      name: true,
      description: true,
      parentId: true,
      children: {
        where: { isActive: true },
        select: { id: true },
      },
    },
  });
  if (!category) throw HttpError.notFound("Category not found");

  const safePage = Math.max(1, Number(page) || 1);
  const safePageSize = Math.min(50, Math.max(1, Number(pageSize) || 12));
  const skip = (safePage - 1) * safePageSize;
  const categoryIds = [category.id, ...category.children.map((c) => c.id)];
  const inCategories = {
    categoryLinks: { some: { categoryId: { in: categoryIds } } },
  };

  const [total, products] = await Promise.all([
    prisma.product.count({
      where: {
        ...PUBLIC_LIST_WHERE,
        ...inCategories,
      },
    }),
    prisma.product.findMany({
      where: {
        ...PUBLIC_LIST_WHERE,
        ...inCategories,
      },
      orderBy: [{ isFeatured: "desc" }, { sortOrder: "asc" }, { createdAt: "desc" }],
      skip,
      take: safePageSize,
      select: PUBLIC_CARD_SELECT,
    }),
  ]);

  const items = products.map((p) => decorateCard(p as unknown as PublicCardRow));
  const totalPages = Math.max(1, Math.ceil(total / safePageSize));

  return {
    items,
    page: safePage,
    pageSize: safePageSize,
    total,
    totalPages,
  };
}

// Products whose linked category (or its parent) belongs to this store slug.
export async function listPublicProductsByDepartmentSlug(slug: string, page = 1, pageSize = 12) {
  const department = await prisma.department.findFirst({
    where: { slug, isActive: true },
    select: { id: true, slug: true, name: true },
  });
  if (!department) throw HttpError.notFound("Store not found");

  const inDepartment = {
    categoryLinks: {
      some: {
        category: {
          isActive: true,
          OR: [
            { departmentId: department.id },
            { parent: { isActive: true, departmentId: department.id } },
          ],
        },
      },
    },
  };

  const safePage = Math.max(1, Number(page) || 1);
  const safePageSize = Math.min(50, Math.max(1, Number(pageSize) || 12));
  const skip = (safePage - 1) * safePageSize;

  const [total, products] = await Promise.all([
    prisma.product.count({
      where: {
        ...PUBLIC_LIST_WHERE,
        ...inDepartment,
      },
    }),
    prisma.product.findMany({
      where: {
        ...PUBLIC_LIST_WHERE,
        ...inDepartment,
      },
      orderBy: [{ isFeatured: "desc" }, { sortOrder: "asc" }, { createdAt: "desc" }],
      skip,
      take: safePageSize,
      select: PUBLIC_CARD_SELECT,
    }),
  ]);

  const items = products.map((p) => decorateCard(p as unknown as PublicCardRow));
  const totalPages = Math.max(1, Math.ceil(total / safePageSize));

  return {
    items,
    page: safePage,
    pageSize: safePageSize,
    total,
    totalPages,
    department,
  };
}

// All same-day-eligible products, ordered like the category listings. Client
// groups them by category — server just filters.
export async function listSameDayProducts() {
  const products = await prisma.product.findMany({
    where: {
      ...PUBLIC_LIST_WHERE,
      supportsSameDayDelivery: true,
    },
    orderBy: [{ isFeatured: "desc" }, { sortOrder: "asc" }, { createdAt: "desc" }],
    select: PUBLIC_CARD_SELECT,
  });

  return products.map((p) => decorateCard(p as unknown as PublicCardRow));
}

// All pan-India shippable products, ordered like the category listings.
export async function listPanIndiaProducts() {
  const products = await prisma.product.findMany({
    where: {
      ...PUBLIC_LIST_WHERE,
      canBeDeliveredPanIndia: true,
    },
    orderBy: [{ isFeatured: "desc" }, { sortOrder: "asc" }, { createdAt: "desc" }],
    select: PUBLIC_CARD_SELECT,
  });

  return products.map((p) => decorateCard(p as unknown as PublicCardRow));
}

// Products flagged for the Healthy Treats section. Orthogonal to same-day /
// pan-India — server just filters; the client groups by category.
export async function listHealthyTreatProducts() {
  const products = await prisma.product.findMany({
    where: {
      ...PUBLIC_LIST_WHERE,
      isHealthyTreat: true,
    },
    orderBy: [{ isFeatured: "desc" }, { sortOrder: "asc" }, { createdAt: "desc" }],
    select: PUBLIC_CARD_SELECT,
  });

  return products.map((p) => decorateCard(p as unknown as PublicCardRow));
}

// Tags flagged showOnHome drive the landing page's product sections, in
// sortOrder. Each tag gets its own query so a section's limit stays independent,
// and empty sections are dropped so the page never renders a bare heading.
export async function listHomeTagShowcase(limitPerTag = 8) {
  const tags = await prisma.tag.findMany({
    where: { showOnHome: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, slug: true, name: true, colorHex: true },
  });

  const safeLimit = Math.min(24, Math.max(1, Number(limitPerTag) || 8));

  const sections = await Promise.all(
    tags.map(async (tag) => {
      const products = await prisma.product.findMany({
        where: {
          ...PUBLIC_LIST_WHERE,
          tags: { some: { id: tag.id } },
        },
        orderBy: [{ isFeatured: "desc" }, { sortOrder: "asc" }, { createdAt: "desc" }],
        take: safeLimit,
        select: PUBLIC_CARD_SELECT,
      });

      return {
        tag: { slug: tag.slug, name: tag.name, colorHex: tag.colorHex },
        products: products.map((p) => decorateCard(p as unknown as PublicCardRow)),
      };
    }),
  );

  return sections.filter((section) => section.products.length > 0);
}

const MIN_PUBLIC_SEARCH_LENGTH = 2;

function buildPublicProductSearchWhere(search: string) {
  const q = search.trim();
  if (q.length < MIN_PUBLIC_SEARCH_LENGTH) return null;
  return {
    ...PUBLIC_LIST_WHERE,
    OR: [
      { name: { contains: q, mode: "insensitive" as const } },
      { slug: { contains: q, mode: "insensitive" as const } },
      { shortDescription: { contains: q, mode: "insensitive" as const } },
      { tags: { some: { name: { contains: q, mode: "insensitive" as const } } } },
      {
        categoryLinks: {
          some: {
            category: { name: { contains: q, mode: "insensitive" as const } },
          },
        },
      },
    ],
  };
}

/** Storefront free-text search. Short/empty queries return an empty page, not an error. */
export async function listPublicProductsBySearch(search: string, page = 1, pageSize = 12) {
  const safePage = Math.max(1, Number(page) || 1);
  const safePageSize = Math.min(50, Math.max(1, Number(pageSize) || 12));
  const where = buildPublicProductSearchWhere(search);

  if (!where) {
    return {
      query: search.trim(),
      items: [] as ReturnType<typeof decorateCard>[],
      total: 0,
      page: safePage,
      pageSize: safePageSize,
      totalPages: 1,
    };
  }

  const [total, products] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      orderBy: [{ isFeatured: "desc" }, { sortOrder: "asc" }, { createdAt: "desc" }],
      skip: (safePage - 1) * safePageSize,
      take: safePageSize,
      select: PUBLIC_CARD_SELECT,
    }),
  ]);

  return {
    query: search.trim(),
    items: products.map((p) => decorateCard(p as unknown as PublicCardRow)),
    total,
    page: safePage,
    pageSize: safePageSize,
    totalPages: Math.max(1, Math.ceil(total / safePageSize)),
  };
}

// Paginated listing for a single tag, backing the section "view all" links.
export async function listPublicProductsByTagSlug(slug: string, page = 1, pageSize = 12) {
  const tag = await prisma.tag.findUnique({
    where: { slug },
    select: { id: true, slug: true, name: true, colorHex: true },
  });
  if (!tag) throw HttpError.notFound("Tag not found");

  const safePage = Math.max(1, Number(page) || 1);
  const safePageSize = Math.min(50, Math.max(1, Number(pageSize) || 12));
  const where = { ...PUBLIC_LIST_WHERE, tags: { some: { id: tag.id } } };

  const [total, products] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      orderBy: [{ isFeatured: "desc" }, { sortOrder: "asc" }, { createdAt: "desc" }],
      skip: (safePage - 1) * safePageSize,
      take: safePageSize,
      select: PUBLIC_CARD_SELECT,
    }),
  ]);

  return {
    tag: { slug: tag.slug, name: tag.name, colorHex: tag.colorHex },
    items: products.map((p) => decorateCard(p as unknown as PublicCardRow)),
    total,
    page: safePage,
    pageSize: safePageSize,
    totalPages: Math.max(1, Math.ceil(total / safePageSize)),
  };
}

// Full product detail for the PDP. Inactive or out-of-stock products 404.
export async function getPublicProductBySlug(slug: string) {
  const product = await prisma.product.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      name: true,
      shortDescription: true,
      description: true,
      images: true,
      basePrice: true,
      productType: true,
      template: true,
      isCustomizable: true,
      isEggless: true,
      sellByPound: true,
      minGrams: true,
      maxGrams: true,
      allowCustomSize: true,
      supportsMessageOnCake: true,
      messageMaxLength: true,
      supportsSameDayDelivery: true,
      leadTimeHours: true,
      canBeDeliveredPanIndia: true,
      isHealthyTreat: true,
      gstRate: true,
      priceIsGstInclusive: true,
      allergens: true,
      isActive: true,
      isAvailable: true,
      categoryLinks: {
        select: {
          category: {
            select: {
              id: true,
              slug: true,
              name: true,
              parent: { select: { id: true, slug: true, name: true } },
            },
          },
        },
      },
      flavors: {
        where: { isActive: true },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        select: {
          id: true,
          slug: true,
          name: true,
          additionalAmount: true,
          isEggless: true,
          isSugarFree: true,
          isHealthy: true,
        },
      },
      toppings: {
        where: { isActive: true },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        select: {
          id: true,
          slug: true,
          name: true,
          kind: true,
          priceDelta: true,
          isVeg: true,
          imageUrl: true,
        },
      },
      addons: {
        where: { isActive: true },
        orderBy: [{ group: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
        select: {
          id: true,
          slug: true,
          name: true,
          group: true,
          priceDelta: true,
          imageUrl: true,
        },
      },
      optionGroups: {
        orderBy: { sortOrder: "asc" },
        select: {
          key: true,
          label: true,
          priceMode: true,
          selectionType: true,
          isRequired: true,
          options: {
            where: { isActive: true },
            orderBy: [{ sortOrder: "asc" }, { key: "asc" }],
            select: {
              id: true,
              key: true,
              label: true,
              price: true,
              weightGrams: true,
              diameterMm: true,
              isDefault: true,
            },
          },
        },
      },
      tags: {
        select: { id: true, slug: true, name: true, colorHex: true },
      },
    },
  });

  if (!product || !product.isActive || !product.isAvailable) {
    throw HttpError.notFound("Product not found");
  }

  const gramsFilter: { gte?: number; lte?: number } = {};
  if (product.minGrams != null) gramsFilter.gte = product.minGrams;
  if (product.maxGrams != null) gramsFilter.lte = product.maxGrams;

  const sizes = product.sellByPound
    ? await prisma.cakeSize.findMany({
        where: {
          isActive: true,
          ...(Object.keys(gramsFilter).length ? { grams: gramsFilter } : {}),
        },
        orderBy: [{ sortOrder: "asc" }, { grams: "asc" }],
        select: {
          id: true,
          grams: true,
          label: true,
          servesText: true,
        },
      })
    : [];

  const { categoryLinks, addons: attachedAddons, ...rest } = product;
  const categoryAddons = await addonsDefaultedToCategories(categoryLinks.map((l) => l.category.id));

  return {
    ...rest,
    categories: categoryLinks.map((l) => l.category),
    addons: mergeAddonsById(attachedAddons, categoryAddons),
    sizes,
  };
}

const addonOfferSelect = {
  id: true,
  slug: true,
  name: true,
  group: true,
  priceDelta: true,
  imageUrl: true,
} as const;

/** Add-ons mapped to these categories or their parents (2-level tree). */
async function addonsDefaultedToCategories(categoryIds: string[]) {
  if (categoryIds.length === 0) return [];
  const rows = await prisma.category.findMany({
    where: { id: { in: categoryIds } },
    select: { id: true, parentId: true },
  });
  const scope = [
    ...new Set([
      ...categoryIds,
      ...rows.map((r) => r.parentId).filter((id): id is string => Boolean(id)),
    ]),
  ];
  return prisma.addon.findMany({
    where: {
      isActive: true,
      defaultCategories: { some: { id: { in: scope } } },
    },
    orderBy: [{ group: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
    select: addonOfferSelect,
  });
}

function mergeAddonsById<T extends { id: string }>(attached: T[], fromCategories: T[]): T[] {
  const map = new Map<string, T>();
  for (const addon of fromCategories) map.set(addon.id, addon);
  for (const addon of attached) map.set(addon.id, addon);
  return [...map.values()];
}

export async function createProduct(input: CreateProductInput) {
  const {
    flavorIds,
    tagIds,
    sizeOptions,
    crustOptions,
    toppingIds,
    addonIds,
    categoryIds,
    ...productData
  } = input;

  const existingSlug = await prisma.product.findUnique({
    where: { slug: input.slug },
    select: { id: true },
  });
  if (existingSlug) throw HttpError.conflict("Slug already exists");

  const uniqueCategoryIds = await assertCategoryIds(categoryIds);

  const product = await prisma.product.create({
    data: {
      ...productData,
      categoryLinks: {
        create: uniqueCategoryIds.map((categoryId) => ({ categoryId })),
      },
      flavors: flavorIds.length ? { connect: flavorIds.map((id) => ({ id })) } : undefined,
      tags: tagIds.length ? { connect: tagIds.map((id) => ({ id })) } : undefined,
      toppings: toppingIds?.length ? { connect: toppingIds.map((id) => ({ id })) } : undefined,
      addons: addonIds?.length ? { connect: addonIds.map((id) => ({ id })) } : undefined,
    },
    select: {
      id: true,
      slug: true,
      name: true,
      basePrice: true,
      isActive: true,
      isAvailable: true,
      createdAt: true,
    },
  });

  await syncOptionGroup(product.id, "size", "Size", "ABSOLUTE", sizeOptions);
  await syncOptionGroup(product.id, "crust", "Crust", "DELTA", crustOptions);

  return product;
}

// Replaces the full OptionGroup for a given key. Passing undefined leaves it alone;
// passing [] removes the group entirely.
async function syncOptionGroup(
  productId: string,
  key: string,
  label: string,
  priceMode: "ABSOLUTE" | "DELTA",
  options: Array<z.infer<typeof optionSchema>> | undefined,
) {
  if (options === undefined) return;
  await prisma.optionGroup.deleteMany({ where: { productId, key } });
  if (!options.length) return;
  await prisma.optionGroup.create({
    data: {
      productId,
      key,
      label,
      selectionType: "SINGLE",
      priceMode,
      isRequired: true,
      sortOrder: 0,
      options: {
        create: options.map((o) => ({
          key: o.key,
          label: o.label,
          price: o.price,
          weightGrams: o.weightGrams ?? null,
          diameterMm: o.diameterMm ?? null,
          isDefault: o.isDefault,
          isActive: o.isActive,
          sortOrder: o.sortOrder,
        })),
      },
    },
  });
}

export const updateProductSchema = createProductSchema.partial();
export type UpdateProductInput = z.infer<typeof updateProductSchema>;

async function assertCategoryIds(ids: string[]) {
  const unique = [...new Set(ids)];
  if (unique.length === 0) {
    throw HttpError.badRequest("Pick at least one category");
  }
  const found = await prisma.category.findMany({
    where: { id: { in: unique } },
    select: { id: true },
  });
  if (found.length !== unique.length) {
    throw HttpError.badRequest("Category not found");
  }
  return unique;
}

export async function getAdminProductById(id: string) {
  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      categoryLinks: {
        select: { category: { select: { id: true, name: true, slug: true } } },
      },
      flavors: { select: { id: true } },
      tags: { select: { id: true } },
      toppings: { select: { id: true } },
      addons: { select: { id: true } },
      optionGroups: {
        orderBy: { sortOrder: "asc" },
        include: {
          options: { orderBy: [{ sortOrder: "asc" }, { key: "asc" }] },
        },
      },
      variants: {
        where: { isActive: true },
        orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
      },
    },
  });
  if (!product) throw HttpError.notFound("Product not found");

  const mapOption = (o: (typeof product.optionGroups)[0]["options"][0]) => ({
    id: o.id,
    key: o.key,
    label: o.label,
    price: Number(o.price),
    weightGrams: o.weightGrams,
    diameterMm: o.diameterMm,
    isDefault: o.isDefault,
    isActive: o.isActive,
    sortOrder: o.sortOrder,
  });

  const optionGroups = product.optionGroups.map((g) => ({
    id: g.id,
    key: g.key,
    label: g.label,
    priceMode: g.priceMode,
    selectionType: g.selectionType,
    isRequired: g.isRequired,
    sortOrder: g.sortOrder,
    options: g.options.filter((o) => o.isActive).map(mapOption),
  }));

  const sizeGroup = optionGroups.find((g) => g.key === "size");
  const crustGroup = optionGroups.find((g) => g.key === "crust");

  const {
    flavors,
    tags,
    toppings,
    addons,
    optionGroups: _optionGroups,
    variants,
    categoryLinks,
    ...rest
  } = product;

  const categoryAddonIds = (
    await addonsDefaultedToCategories(categoryLinks.map((l) => l.category.id))
  ).map((a) => a.id);

  return {
    ...rest,
    categoryIds: categoryLinks.map((l) => l.category.id),
    categories: categoryLinks.map((l) => l.category),
    flavorIds: flavors.map((f) => f.id),
    tagIds: tags.map((t) => t.id),
    toppingIds: toppings.map((t) => t.id),
    addonIds: addons.map((a) => a.id),
    offeredAddonIds: [...new Set([...addons.map((a) => a.id), ...categoryAddonIds])],
    optionGroups,
    sizeOptions: sizeGroup?.options ?? [],
    crustOptions: crustGroup?.options ?? [],
    fixedVariants: variants.map((v) => ({
      id: v.id,
      sku: v.sku,
      label: v.label,
      price: Number(v.price),
      attributes: v.attributes as Record<string, unknown> | null,
      isActive: v.isActive,
      isAvailable: v.isAvailable,
      sortOrder: v.sortOrder,
    })),
  };
}

export async function updateProduct(id: string, input: UpdateProductInput) {
  const {
    flavorIds,
    tagIds,
    toppingIds,
    addonIds,
    sizeOptions,
    crustOptions,
    categoryIds,
    slug,
    ...rest
  } = input;

  const existing = await prisma.product.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!existing) throw HttpError.notFound("Product not found");

  if (slug) {
    const dup = await prisma.product.findFirst({
      where: { slug, NOT: { id } },
      select: { id: true },
    });
    if (dup) throw HttpError.conflict("Slug already exists");
  }

  let uniqueCategoryIds: string[] | undefined;
  if (categoryIds !== undefined) {
    uniqueCategoryIds = await assertCategoryIds(categoryIds);
  }

  const updated = await prisma.product.update({
    where: { id },
    data: {
      ...rest,
      ...(slug ? { slug } : {}),
      ...(uniqueCategoryIds
        ? {
            categoryLinks: {
              deleteMany: {},
              create: uniqueCategoryIds.map((categoryId) => ({
                categoryId,
              })),
            },
          }
        : {}),
      ...(flavorIds !== undefined
        ? { flavors: { set: flavorIds.map((fid) => ({ id: fid })) } }
        : {}),
      ...(tagIds !== undefined ? { tags: { set: tagIds.map((tid) => ({ id: tid })) } } : {}),
      ...(toppingIds !== undefined
        ? { toppings: { set: toppingIds.map((tid) => ({ id: tid })) } }
        : {}),
      ...(addonIds !== undefined ? { addons: { set: addonIds.map((aid) => ({ id: aid })) } } : {}),
    },
    select: {
      id: true,
      slug: true,
      name: true,
      basePrice: true,
      isActive: true,
      isAvailable: true,
      updatedAt: true,
    },
  });

  await syncOptionGroup(id, "size", "Size", "ABSOLUTE", sizeOptions);
  await syncOptionGroup(id, "crust", "Crust", "DELTA", crustOptions);

  return updated;
}
