import { useMemo, type ReactNode } from "react";
import { Package, Plus, Sparkles } from "lucide-react";
import { cn } from "@/lib/cn";
import { useAllAdminProducts, type AdminProduct } from "@/hooks/useAdminProducts";
import { useCategoryTree, type CategoryNode } from "@/hooks/useCategories";
import { buildCatalogPicker } from "@/lib/catalogProductOptions";
import { useFlavours } from "@/hooks/useFlavours";
import { useAdminToppings } from "@/hooks/useToppings";
import { useAdminAddons } from "@/hooks/useAddons";
import type { OrderLinkKind } from "@/hooks/useAdminOrderLinks";
import { useStaffPermission } from "@/lib/permissions";
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
  const canAddProducts = useStaffPermission("products.write");
  const shopCategoryOptions = useMemo(
    () =>
      categoryTree.flatMap((parent) => [
        { value: parent.id, label: parent.name, keywords: parent.name },
        ...parent.children.map((child) => ({
          value: child.id,
          label: `${parent.name} → ${child.name}`,
          keywords: `${parent.name} ${child.name}`,
        })),
      ]),
    [categoryTree],
  );

  return (
    <FormSection
      title="Items"
      subtitle="Add a custom one-off, or pick from the menu."
      action={
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <AddItemButton
            onClick={() => addItem("CUSTOM")}
            icon={<Sparkles className="h-4 w-4" />}
            label="Custom item"
            hint="Your own price"
            className="border-brand-100 bg-brand-100/40 text-brand-700 hover:border-brand-500"
            iconClassName="bg-brand-100 text-brand-700"
          />
          <AddItemButton
            onClick={() => addItem("CATALOG")}
            icon={<Package className="h-4 w-4" />}
            label="Catalog item"
            hint="From the menu"
            className="border-sky-200 bg-sky-50 text-sky-700 hover:border-sky-500"
            iconClassName="bg-sky-100 text-sky-700"
          />
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
            shopCategoryOptions={canAddProducts ? shopCategoryOptions : null}
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

/** Coloured like the item's badge (pink custom, blue catalog) so the new card matches the button. */
function AddItemButton({
  onClick,
  icon,
  label,
  hint,
  className,
  iconClassName,
}: {
  onClick: () => void;
  icon: ReactNode;
  label: string;
  hint: string;
  className: string;
  iconClassName: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex min-w-0 items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left transition",
        className,
      )}
    >
      <span
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-md",
          iconClassName,
        )}
      >
        {icon}
      </span>
      <span className="min-w-0">
        <span className="flex items-center gap-0.5 text-xs font-semibold">
          <Plus className="h-3 w-3 shrink-0" />
          <span className="truncate">{label}</span>
        </span>
        <span className="block truncate text-[11px] text-slate-500">{hint}</span>
      </span>
    </button>
  );
}
