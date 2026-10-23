import { seedVendors } from "../src/modules/finance/vendor.seed.js";
import { prisma } from "../src/config/db.js";

await seedVendors();
await prisma.$disconnect();
