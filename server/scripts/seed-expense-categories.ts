import { seedExpenseCategories } from "../src/modules/finance/expense-category.seed.js";
import { prisma } from "../src/config/db.js";

await seedExpenseCategories();
await prisma.$disconnect();
