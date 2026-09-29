import { useCallback, useState } from "react";
import type { OrderLinkKind } from "@/hooks/useAdminOrderLinks";
import { newOrderItem, type OrderItemDraft } from "./types";

export function useOrderItemsState(initialKind: OrderLinkKind = "CUSTOM") {
  const [items, setItems] = useState<OrderItemDraft[]>(() => [newOrderItem(initialKind)]);

  const patchItem = useCallback((id: string, patch: Partial<OrderItemDraft>) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }, []);

  const removeItem = useCallback(
    (id: string) => {
      setItems((prev) => {
        const next = prev.filter((it) => it.id !== id);
        return next.length ? next : [newOrderItem(initialKind)];
      });
    },
    [initialKind],
  );

  const addItem = useCallback((kind: OrderLinkKind) => {
    setItems((prev) => [newOrderItem(kind), ...prev]);
  }, []);

  return { items, setItems, patchItem, removeItem, addItem };
}
