import { useMemo } from "react";
import { Plus } from "lucide-react";
import { useAllAdminProducts, type AdminProduct } from "@/hooks/useAdminProducts";
import { useCategoryTree, type CategoryNode } from "@/hooks/useCategories";
import { buildCatalogPicker } from "@/lib/catalogProductOptions";
import { useFlavours } from "@/hooks/useFlavours";
import { useAdminToppings } from "@/hooks/useToppings";
import { useAdminAddons } from "@/hooks/useAddons";
import type { OrderLinkKind } from "@/hooks/useAdminOrderLinks";
import { FormSection } from "./FormSection";
import { OrderItemRow } from "./OrderItemRow";
import type { OrderItemDraft } from "./types";

const EMPTY_PRODUCTS: AdminProduct[] = [];
const EMPTY_TREE: CategoryNode[] = [];

type Props = {
  items: OrderItemDraft[];
  patchItem: (id: string, patch: Partial<OrderItemDraft>) => void;
  removeItem: (id: string) => void;
  addItem: (kind: OrderLinkKind) => void;
  listClassName?: string;
};

export function OrderItemsEditor({
  items,
  patchItem,
  removeItem,
  addItem,
  listClassName = "space-y-3",
}: Props) {
  const { data: products = EMPTY_PRODUCTS } = useAllAdminProducts();
  const { data: categoryTree = EMPTY_TREE } = useCategoryTree();
  const catalogPicker = useMemo(
    () => buildCatalogPicker(products, categoryTree),
    [products, categoryTree],
  );
  const { data: flavours = [] } = useFlavours();
  const { data: allToppings = [] } = useAdminToppings();
  const { data: allAddons = [] } = useAdminAddons();

  return (
    <FormSection
      title="Items"
      subtitle="Add a custom one-off, or pick from the menu."
      action={
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => addItem("CUSTOM")}
            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:border-brand-500 hover:text-brand-700"
          >
            <Plus className="h-3 w-3" /> Custom item
          </button>
          <button
            type="button"
            onClick={() => addItem("CATALOG")}
            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:border-brand-500 hover:text-brand-700"
          >
            <Plus className="h-3 w-3" /> Catalog item
          </button>
        </div>
      }
    >
      <div className={listClassName}>
        {items.map((item, idx) => (
          <OrderItemRow
            key={item.id}
            index={idx}
            item={item}
            products={products}
            catalogPicker={catalogPicker}
            flavours={flavours}
            allToppings={allToppings}
            allAddons={allAddons}
            onPatch={(patch) => patchItem(item.id, patch)}
            onRemove={() => removeItem(item.id)}
            canRemove={items.length > 1}
          />
        ))}
      </div>
    </FormSection>
  );
}
