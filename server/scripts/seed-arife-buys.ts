import { seedExpenseCategories } from "../src/modules/finance/expense-category.seed.js";
import { seedArifePurchases } from "../src/modules/finance/purchase.seed.js";
import { prisma } from "../src/config/db.js";

await seedExpenseCategories();
await seedArifePurchases();
await prisma.$disconnect();
