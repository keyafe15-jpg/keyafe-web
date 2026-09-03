import type { OrderLinkItemPayload } from "@/hooks/useAdminOrderLinks";
import type { OfflineOrderItemPayload } from "@/hooks/useOfflineOrders";
import type { AdminTopping } from "@/hooks/useToppings";
import { uploadImage } from "@/lib/uploads";
import type { OrderItemDraft } from "./types";

export function resolveFlavourName(
  item: Pick<OrderItemDraft, "flavourId" | "customFlavour">,
  flavours: Array<{ id: string; name: string }>,
): string | null {
  const custom = item.customFlavour.trim();
  if (custom) return custom;
  if (!item.flavourId) return null;
  return flavours.find((f) => f.id === item.flavourId)?.name ?? null;
}

export function composePizzaNotes(
  item: OrderItemDraft,
  allToppings: AdminTopping[],
): string | null {
  const picked = allToppings.filter((t) =>
    item.toppingSelections.includes(t.id),
  );
  const parts: string[] = [];
  if (item.crustLabel) parts.push(`Crust: ${item.crustLabel}`);
  const toppingsPart = picked
    .filter((t) => t.kind === "TOPPING")
    .map((t) => t.name)
    .join(", ");
  if (toppingsPart) parts.push(`Toppings: ${toppingsPart}`);
  const condimentsPart = picked
    .filter((t) => t.kind === "CONDIMENT")
    .map((t) => t.name)
    .join(", ");
  if (condimentsPart) parts.push(`Condiments: ${condimentsPart}`);
  return parts.length ? parts.join(" · ") : null;
}

export function mergeInstructions(
  composedPrefix: string | null,
  instructions: string,
): string | null {
  const trimmed = instructions.trim();
  if (composedPrefix && trimmed) return `${composedPrefix}\n${trimmed}`;
  return composedPrefix || trimmed || null;
}

export function validateOrderItems(items: OrderItemDraft[]): boolean {
  return items.every(
    (it) =>
      it.productName.trim().length >= 2 &&
      Number(it.unitPrice) > 0 &&
      Number(it.qty) > 0 &&
      (it.kind === "CUSTOM" || it.productId),
  );
}

export async function resolveReferenceImageUrl(
  item: OrderItemDraft,
): Promise<string | null> {
  if (item.kind === "CATALOG") return null;
  if (item.refFile) {
    const res = await uploadImage(item.refFile, "quote-reference");
    return res.publicUrl;
  }
  return item.keptImageUrl;
}

export function toOrderLinkItemPayload(
  item: OrderItemDraft,
  referenceImageUrl: string | null,
  flavours: Array<{ id: string; name: string }>,
  allToppings: AdminTopping[],
): OrderLinkItemPayload {
  const pizzaNotes = composePizzaNotes(item, allToppings);
  const messageHint = mergeInstructions(
    pizzaNotes,
    item.messageOnCake.trim() || "",
  );

  return {
    kind: item.kind,
    productId: item.kind === "CATALOG" ? item.productId : null,
    productName: item.productName.trim(),
    sizeLabel: item.sizeLabel.trim() || null,
    sizeGrams: item.sizeGrams ? Number(item.sizeGrams) : null,
    flavourId: item.flavourId || null,
    flavourName: resolveFlavourName(item, flavours),
    referenceImageUrl,
    messageHint,
    unitPrice: Number(item.unitPrice),
    qty: Number(item.qty) || 1,
  };
}

export function toOfflineOrderItemPayload(
  item: OrderItemDraft,
  referenceImageUrl: string | null,
  flavours: Array<{ id: string; name: string }>,
  allToppings: AdminTopping[],
): OfflineOrderItemPayload {
  const pizzaNotes = composePizzaNotes(item, allToppings);

  return {
    kind: item.kind,
    productId: item.kind === "CATALOG" ? item.productId : null,
    productName: item.productName.trim(),
    sizeLabel: item.sizeLabel.trim() || null,
    sizeGrams: item.sizeGrams ? Number(item.sizeGrams) : null,
    flavourId: item.flavourId || null,
    flavourName: resolveFlavourName(item, flavours),
    referenceImageUrl,
    messageOnCake: item.messageOnCake.trim() || null,
    instructions: mergeInstructions(pizzaNotes, item.instructions),
    unitPrice: Number(item.unitPrice),
    qty: Number(item.qty) || 1,
  };
}
