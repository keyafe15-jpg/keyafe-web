import { useMemo } from "react";
import { gstAddedOnTop } from "@keyafe/shared";
import { useAllAdminProducts, type AdminProduct } from "@/hooks/useAdminProducts";
import type { OrderItemDraft } from "./types";

const EMPTY_PRODUCTS: AdminProduct[] = [];

/**
 * GST the server will add on top of the items total for catalog products
 * priced exclusive of GST. Custom items are always GST-inclusive.
 */
export function useOrderItemsGstOnTop(items: OrderItemDraft[], discount: number): number {
  const { data: products = EMPTY_PRODUCTS } = useAllAdminProducts();
  return useMemo(() => {
    const byId = new Map(products.map((p) => [p.id, p]));
    return gstAddedOnTop(
      items.map((it) => {
        const product = it.kind === "CATALOG" ? byId.get(it.productId) : undefined;
        return {
          amount: Number(it.unitPrice || 0) * Number(it.qty || 0),
          gstRate: product?.gstRate,
          priceIsGstInclusive: product?.priceIsGstInclusive,
        };
      }),
      discount,
    );
  }, [items, products, discount]);
}
