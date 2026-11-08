import "../src/config/env.js";
import { seedExpenseCategories } from "../src/modules/finance/expense-category.seed.js";
import { seedBooksPayers } from "../src/modules/finance/payer.seed.js";
import { seedVendors } from "../src/modules/finance/vendor.seed.js";
import { prisma } from "../src/config/db.js";

await seedExpenseCategories();
await seedBooksPayers();
await seedVendors();
await prisma.$disconnect();
