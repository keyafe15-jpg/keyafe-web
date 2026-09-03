import { Plus } from "lucide-react";
import { useAdminProducts } from "@/hooks/useAdminProducts";
import { useFlavours } from "@/hooks/useFlavours";
import { useAdminToppings } from "@/hooks/useToppings";
import { useAdminCakeSizes } from "@/hooks/useCakeSizes";
import type { OrderLinkKind } from "@/hooks/useAdminOrderLinks";
import { FormSection } from "./FormSection";
import { OrderItemRow } from "./OrderItemRow";
import type { OrderItemDraft } from "./types";

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
  const { data: productsPage } = useAdminProducts(1, 100);
  const products = productsPage?.items ?? [];
  const { data: flavours = [] } = useFlavours();
  const { data: allToppings = [] } = useAdminToppings();
  const { data: cakeSizes = [] } = useAdminCakeSizes();

  return (
    <FormSection
      title="Items"
      subtitle="Catalog picks a product from your menu; Custom is a one-off item."
      action={
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => addItem("CATALOG")}
            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:border-brand-500 hover:text-brand-700"
          >
            <Plus className="h-3 w-3" /> Catalog item
          </button>
          <button
            type="button"
            onClick={() => addItem("CUSTOM")}
            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:border-brand-500 hover:text-brand-700"
          >
            <Plus className="h-3 w-3" /> Custom item
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
            flavours={flavours}
            allToppings={allToppings}
            cakeSizes={cakeSizes}
            onPatch={(patch) => patchItem(item.id, patch)}
            onRemove={() => removeItem(item.id)}
            canRemove={items.length > 1}
          />
        ))}
      </div>
    </FormSection>
  );
}
