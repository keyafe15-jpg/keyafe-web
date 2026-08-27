import { prisma } from "../../config/db.js";

export interface CategoryNode {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  sortOrder: number;
  children: CategoryNode[];
}

// Returns active top-level categories with their active children nested.
// Simple 2-level tree — sufficient for launch. Extend to recursive if we ever need deeper.
export async function getCategoryTree(): Promise<CategoryNode[]> {
  const rows = await prisma.category.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      slug: true,
      name: true,
      description: true,
      imageUrl: true,
      sortOrder: true,
      parentId: true,
    },
  });

  const byParent = new Map<string | null, typeof rows>();
  for (const row of rows) {
    const key = row.parentId ?? null;
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key)!.push(row);
  }

  const build = (parentId: string | null): CategoryNode[] =>
    (byParent.get(parentId) ?? []).map((r) => ({
      id: r.id,
      slug: r.slug,
      name: r.name,
      description: r.description,
      imageUrl: r.imageUrl,
      sortOrder: r.sortOrder,
      children: build(r.id),
    }));

  return build(null);
}
