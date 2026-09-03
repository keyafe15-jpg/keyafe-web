import { useEffect } from "react";
import type { OrderItemDraft } from "./types";

/** Keeps blob preview URLs in sync when reference files change. */
export function useOrderItemRefPreviews(
  items: OrderItemDraft[],
  setItems: React.Dispatch<React.SetStateAction<OrderItemDraft[]>>,
) {
  useEffect(() => {
    const createdUrls: string[] = [];
    setItems((prev) =>
      prev.map((it) => {
        if (it.refFile) {
          if (it.refPreview?.startsWith("blob:")) return it;
          const url = URL.createObjectURL(it.refFile);
          createdUrls.push(url);
          return { ...it, refPreview: url };
        }
        return it.refPreview ? { ...it, refPreview: null } : it;
      }),
    );
    return () => {
      createdUrls.forEach((u) => URL.revokeObjectURL(u));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.map((i) => i.refFile).join("|")]);
}
