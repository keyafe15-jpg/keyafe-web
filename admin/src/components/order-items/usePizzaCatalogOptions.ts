import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import type { AdminProduct, AdminProductDetail } from "@/hooks/useAdminProducts";
import { api } from "@/lib/api";
import { getSizeOptionGroup } from "@/lib/productConfiguration";

export interface PizzaSizePreset {
  /** Stable select value — inch sizes use `inch:4`, others use a slug of the label. */
  key: string;
  label: string;
}

export interface PizzaCrustPreset {
  id: string;
  label: string;
  price: number;
}

const FALLBACK_PIZZA_SIZES = [
  "4 inch",
  "6 inch",
  "8 inch",
  "10 inch",
  "12 inch",
  "14 inch",
];

function inchSortKey(label: string): number {
  const match = label.match(/(\d+(?:\.\d+)?)/);
  return match ? Number(match[1]) : 999;
}

/** Collapse "4", "4 inch", `4"` etc. into one canonical entry. */
function normalizePizzaSize(rawLabel: string): { key: string; label: string } {
  const trimmed = rawLabel.trim();
  const inchMatch = trimmed.match(
    /^(\d+(?:\.\d+)?)\s*(?:inch|inches|in|"|''|″)?$/i,
  );
  if (inchMatch) {
    const inches = Number(inchMatch[1]);
    const rounded =
      Math.round(inches * 10) / 10 === inches
        ? String(inches)
        : String(Math.round(inches * 10) / 10);
    return { key: `inch:${rounded}`, label: `${rounded} inch` };
  }
  const slug = trimmed.toLowerCase().replace(/\s+/g, "-");
  return { key: `label:${slug}`, label: trimmed };
}

function addPizzaSize(
  sizeMap: Map<string, PizzaSizePreset>,
  rawLabel: string,
) {
  const { key, label } = normalizePizzaSize(rawLabel);
  if (!sizeMap.has(key)) {
    sizeMap.set(key, { key, label });
  }
}

/** Sizes and crusts aggregated from catalog pizza products. */
export function usePizzaCatalogOptions(pizzaProducts: AdminProduct[]) {
  const queries = useQueries({
    queries: pizzaProducts.map((p) => ({
      queryKey: ["admin", "product", p.id],
      queryFn: () => api.get<AdminProductDetail>(`/admin/products/${p.id}`),
      staleTime: 60_000,
    })),
  });

  return useMemo(() => {
    const sizeMap = new Map<string, PizzaSizePreset>();
    const crustMap = new Map<string, PizzaCrustPreset>();

    for (const query of queries) {
      const detail = query.data;
      if (!detail) continue;

      const sizeGroup = getSizeOptionGroup(detail);
      for (const option of sizeGroup?.options ?? []) {
        if (option.isActive === false) continue;
        addPizzaSize(sizeMap, option.label);
      }

      for (const option of detail.crustOptions ?? []) {
        if (option.isActive === false) continue;
        if (!crustMap.has(option.label)) {
          crustMap.set(option.label, {
            id: option.label,
            label: option.label,
            price: Number(option.price),
          });
        }
      }
    }

    if (sizeMap.size === 0) {
      for (const label of FALLBACK_PIZZA_SIZES) {
        addPizzaSize(sizeMap, label);
      }
    }

    const sizes = [...sizeMap.values()].sort(
      (a, b) => inchSortKey(a.label) - inchSortKey(b.label),
    );
    const crusts = [...crustMap.values()].sort((a, b) =>
      a.label.localeCompare(b.label),
    );

    return {
      sizes,
      crusts,
      isLoading: queries.some((q) => q.isLoading),
    };
  }, [queries]);
}

export function pizzaSizeLabelForKey(
  presets: PizzaSizePreset[],
  key: string,
): string {
  return presets.find((s) => s.key === key)?.label ?? key;
}
