// Upserts PERMISSION_CATALOG into the database without running the full seed.
// Use this after adding a permission to the catalog, so existing environments
// pick it up. Upsert-only: it never removes grants or touches other data.
//
// Run: ./node_modules/.bin/tsx scripts/sync-permissions.ts
import { prisma } from "../src/config/db.js";
import { syncPermissionCatalog } from "../src/modules/staff/rbac.seed.js";
import { PERMISSION_CATALOG } from "../src/modules/staff/rbac.catalog.js";

async function main() {
  const before = await prisma.permission.count();
  await syncPermissionCatalog();
  const after = await prisma.permission.count();

  console.log(
    `Synced ${PERMISSION_CATALOG.length} catalog entries — permissions went from ${before} to ${after}`,
  );

  const rows = await prisma.permission.findMany({
    orderBy: [{ category: "asc" }, { sortOrder: "asc" }],
    select: { key: true, label: true, category: true },
  });
  for (const row of rows) {
    console.log(`  ${row.category.padEnd(12)} ${row.key.padEnd(24)} ${row.label}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
