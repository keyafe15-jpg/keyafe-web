import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface CategoryNode {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  sortOrder: number;
  department: { id: string; slug: string; name: string } | null;
  children: CategoryNode[];
}

export function useCategories() {
  return useQuery<CategoryNode[]>({
    queryKey: ["categories"],
    queryFn: () => api.get<CategoryNode[]>("/categories"),
    staleTime: 5 * 60_000,
  });
}

export interface Department {
  id: string;
  slug: string;
  name: string;
  sortOrder: number;
  accentHex: string;
  softHex: string;
  deepHex: string;
}

export function useDepartments() {
  return useQuery<Department[]>({
    queryKey: ["departments"],
    queryFn: () => api.get<Department[]>("/departments"),
    staleTime: 5 * 60_000,
  });
}

export interface CategoryDepartmentGroup {
  department: Department | null;
  categories: CategoryNode[];
}

export function groupCategoriesByDepartment(
  categories: CategoryNode[],
  departments: Department[],
): CategoryDepartmentGroup[] {
  const byId = new Map<string, CategoryNode[]>();
  const ungrouped: CategoryNode[] = [];

  for (const category of categories) {
    const id = category.department?.id;
    if (!id) {
      ungrouped.push(category);
      continue;
    }
    const list = byId.get(id);
    if (list) list.push(category);
    else byId.set(id, [category]);
  }

  const groups: CategoryDepartmentGroup[] = departments
    .map((department) => ({
      department,
      categories: byId.get(department.id) ?? [],
    }))
    .filter((group) => group.categories.length > 0);

  if (ungrouped.length > 0) {
    groups.push({ department: null, categories: ungrouped });
  }

  return groups;
}

export function storePath(slug: string) {
  return `/store/${slug}`;
}
