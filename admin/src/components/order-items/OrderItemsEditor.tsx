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
import {
  ReorderHandle,
  ReorderList,
  type ReorderItemContext,
} from "@/components/reorder/ReorderList";
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
  onReorder?: (next: OrderItemDraft[]) => void;
  listClassName?: string;
  mode?: "take" | "edit";
  extraAction?: ReactNode;
  itemFooter?: (item: OrderItemDraft) => ReactNode;
};

export function OrderItemsEditor({
  items,
  patchItem,
  removeItem,
  addItem,
  onReorder,
  listClassName = "space-y-3",
  mode = "take",
  extraAction,
  itemFooter,
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

  const addButtons = (
    <div className="grid grid-cols-2 gap-2 sm:flex">
      <AddItemButton
        onClick={() => addItem("CUSTOM")}
        icon={<Sparkles className="h-4 w-4" />}
        label="Custom item"
        shortLabel="Custom"
        hint="Your own price"
        className="border-brand-100 bg-brand-100/40 text-brand-700 hover:border-brand-500"
        iconClassName="bg-brand-100 text-brand-700"
      />
      <AddItemButton
        onClick={() => addItem("CATALOG")}
        icon={<Package className="h-4 w-4" />}
        label="Catalog item"
        shortLabel="Catalog"
        hint="From the menu"
        className="border-sky-200 bg-sky-50 text-sky-700 hover:border-sky-500"
        iconClassName="bg-sky-100 text-sky-700"
      />
    </div>
  );

  const canReorder = Boolean(onReorder) && items.length > 1;

  const renderRow = (item: OrderItemDraft, idx: number, ctx?: ReorderItemContext) => (
    <div key={item.id} ref={ctx?.setNodeRef} style={ctx?.style}>
      <OrderItemRow
        index={idx}
        item={item}
        products={products}
        catalogPicker={catalogPicker}
        shopCategoryOptions={mode === "edit" ? shopCategoryOptions : canAddProducts ? shopCategoryOptions : null}
        flavours={flavours}
        allToppings={allToppings}
        allAddons={allAddons}
        onPatch={(patch) => patchItem(item.id, patch)}
        onRemove={() => removeItem(item.id)}
        canRemove={items.length > 1}
        mode={mode}
        footer={itemFooter?.(item)}
      />
      {ctx && (
        <ReorderHandle layout="below" {...ctx.handleProps} />
      )}
    </div>
  );

  const rows = canReorder ? (
    <ReorderList items={items} onReorder={onReorder!} className={listClassName}>
      {(item, ctx) => renderRow(item, items.findIndex((it) => it.id === item.id), ctx)}
    </ReorderList>
  ) : (
    <div className={listClassName}>
      {items.map((item, idx) => renderRow(item, idx))}
    </div>
  );

  if (mode === "edit") {
    return (
      <div>
        <div className="flex flex-wrap items-start justify-between gap-2">
          {addButtons}
          {extraAction}
        </div>
        <div className="mt-2.5">{rows}</div>
      </div>
    );
  }

  return (
    <FormSection
      title="Items"
      subtitle="Add a custom one-off, or pick from the menu."
      action={addButtons}
    >
      {rows}
    </FormSection>
  );
}

/** Coloured like the item's badge (pink custom, blue catalog) so the new card matches the button. */
function AddItemButton({
  onClick,
  icon,
  label,
  shortLabel,
  hint,
  className,
  iconClassName,
}: {
  onClick: () => void;
  icon: ReactNode;
  label: string;
  shortLabel?: string;
  hint: string;
  className: string;
  iconClassName: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className={cn(
        "flex min-w-0 items-center gap-1.5 rounded-lg border px-2 py-1.5 text-left transition sm:gap-2 sm:px-2.5",
        className,
      )}
    >
      <span
        className={cn(
          "hidden h-7 w-7 shrink-0 items-center justify-center rounded-md sm:flex",
          iconClassName,
        )}
      >
        {icon}
      </span>
      <span className="min-w-0">
        <span className="flex items-center gap-0.5 text-xs font-semibold">
          <Plus className="h-3 w-3 shrink-0" />
          <span className="sm:hidden">{shortLabel ?? label}</span>
          <span className="hidden sm:inline">{label}</span>
        </span>
        <span className="block text-[11px] text-slate-500">{hint}</span>
      </span>
    </button>
  );
}
