/**
 * Upserts the Playwright smoke coupon into whatever DATABASE_URL is set.
 * Run from server/ so @prisma/client resolves.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const now = new Date();
  const until = new Date(now);
  until.setFullYear(until.getFullYear() + 1);

  await prisma.coupon.upsert({
    where: { code: "E2E10" },
    create: {
      code: "E2E10",
      type: "PERCENT",
      value: 10,
      minCartAmount: null,
      maxDiscount: 200,
      applicableCategoryIds: [],
      perCustomerLimit: null,
      totalUsageLimit: null,
      validFrom: now,
      validUntil: until,
      waivesDelivery: false,
      isActive: true,
      showOnStorefront: false,
      note: "Playwright smoke coupon",
    },
    update: {
      type: "PERCENT",
      value: 10,
      maxDiscount: 200,
      isActive: true,
      validFrom: now,
      validUntil: until,
    },
  });
  console.log("Seeded coupon E2E10");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
