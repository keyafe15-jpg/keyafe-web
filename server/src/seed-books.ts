import "./config/env.js";
import { seedExpenseCategories } from "./modules/finance/expense-category.seed.js";
import { seedBooksPayers } from "./modules/finance/payer.seed.js";
import { seedVendors } from "./modules/finance/vendor.seed.js";
import { prisma } from "./config/db.js";

await seedExpenseCategories();
await seedBooksPayers();
await seedVendors();
await prisma.$disconnect();
