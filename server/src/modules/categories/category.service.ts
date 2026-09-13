import { prisma } from "../../config/db.js";

export interface DepartmentRef {
  id: string;
  slug: string;
  name: string;
}

export interface CategoryNode {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  sortOrder: number;
  department: DepartmentRef | null;
  children: CategoryNode[];
}

const departmentSelect = { id: true, slug: true, name: true } as const;

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
      department: { select: departmentSelect },
    },
  });

  const byParent = new Map<string | null, typeof rows>();

  for (const row of rows) {
    const key = row.parentId ?? null;
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key)!.push(row);
  }

  const build = (
    parentId: string | null,
    inheritedDepartment: DepartmentRef | null,
  ): CategoryNode[] =>
    (byParent.get(parentId) ?? []).map((r) => {
      const department = inheritedDepartment ?? r.department;
      return {
        id: r.id,
        slug: r.slug,
        name: r.name,
        description: r.description,
        imageUrl: r.imageUrl,
        sortOrder: r.sortOrder,
        department,
        children: build(r.id, department),
      };
    });
  return build(null, null);
}
