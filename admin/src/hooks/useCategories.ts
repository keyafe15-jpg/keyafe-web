import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface CategoryNode {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  sortOrder: number;
  children: CategoryNode[];
}

export function useCategoryTree() {
  return useQuery<CategoryNode[]>({
    queryKey: ["categories"],
    queryFn: () => api.get<CategoryNode[]>("/categories"),
    staleTime: 5 * 60_000,
  });
}

// Flat list — every category including subcategories — for admin dropdowns.
// Sub-categories are prefixed "Parent → Child" so admin can tell them apart.
export interface FlatCategory {
  id: string;
  slug: string;
  label: string;
  parentId: string | null;
  parentSlug: string | null;
}

export function useFlatCategories() {
  const tree = useCategoryTree();
  const flat: FlatCategory[] = [];
  for (const parent of tree.data ?? []) {
    flat.push({
      id: parent.id,
      slug: parent.slug,
      label: parent.name,
      parentId: null,
      parentSlug: null,
    });
    for (const child of parent.children) {
      flat.push({
        id: child.id,
        slug: child.slug,
        label: `${parent.name} → ${child.name}`,
        parentId: parent.id,
        parentSlug: parent.slug,
      });
    }
  }
  return { ...tree, data: flat };
}
