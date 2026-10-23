import { prisma } from "../../config/db.js";
import { logger } from "../../utils/logger.js";

const CATEGORIES: {
  slug: string;
  name: string;
  sortOrder: number;
  marketing?: boolean;
  requiresNote?: boolean;
}[] = [
  { slug: "raw-materials", name: "Raw materials", sortOrder: 0 },
  { slug: "packaging", name: "Packaging", sortOrder: 1 },
  { slug: "salary", name: "Salary", sortOrder: 2 },
  { slug: "rent", name: "Rent", sortOrder: 3 },
  { slug: "utilities", name: "Utilities", sortOrder: 4 },
  { slug: "delivery", name: "Delivery", sortOrder: 5 },
  { slug: "ads", name: "Ads", sortOrder: 6, marketing: true },
  { slug: "influencer", name: "Influencer fee", sortOrder: 7, marketing: true },
  { slug: "giveaway", name: "Giveaway / collab", sortOrder: 8, marketing: true },
  { slug: "equipment", name: "Equipment", sortOrder: 9 },
  { slug: "drawings", name: "Owner drawings", sortOrder: 10 },
  { slug: "miscellaneous", name: "Miscellaneous", sortOrder: 11, requiresNote: true },
];

export async function seedExpenseCategories() {
  for (const row of CATEGORIES) {
    await prisma.expenseCategory.upsert({
      where: { slug: row.slug },
      create: {
        slug: row.slug,
        name: row.name,
        sortOrder: row.sortOrder,
        marketing: row.marketing ?? false,
        requiresNote: row.requiresNote ?? false,
      },
      update: {
        name: row.name,
        sortOrder: row.sortOrder,
        marketing: row.marketing ?? false,
        requiresNote: row.requiresNote ?? false,
      },
    });
  }
  logger.info(`Expense categories seed: ${CATEGORIES.length} upserted`);
}
