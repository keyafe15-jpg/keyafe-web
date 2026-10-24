import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { prisma } from "../src/config/db.js";
import { importRecipesFromCsv } from "../src/modules/recipes/recipe.csv.js";

const fallback = join(dirname(fileURLToPath(import.meta.url)), "../prisma/data/keyafe_recipes.csv");
const path = process.argv[2] || fallback;
const result = await importRecipesFromCsv(readFileSync(path, "utf8"));
console.log(
  `Imported ${result.created}, skipped ${result.skipped}` +
    (result.errors.length ? `, ${result.errors.length} failed` : ""),
);
for (const err of result.errors) {
  console.error(`  ${err.name}: ${err.message}`);
}
await prisma.$disconnect();
if (result.errors.length) process.exitCode = 1;
