import type { OrderLinkItemPayload } from "@/hooks/useAdminOrderLinks";
import type { OfflineOrderItemPayload } from "@/hooks/useOfflineOrders";
import type { AdminTopping } from "@/hooks/useToppings";
import type { AdminAddon } from "@/hooks/useAddons";
import { uploadImage } from "@/lib/uploads";
import { MAX_REF_IMAGES } from "./RefImagesPicker";
import { wantsCatalogSave } from "./saveToCatalog";
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
  const picked = allToppings.filter((t) => item.toppingSelections.includes(t.id));
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

export function composeAddonNotes(
  item: Pick<OrderItemDraft, "addonSelections">,
  allAddons: AdminAddon[],
): string | null {
  const picked = allAddons.filter((a) => (item.addonSelections ?? []).includes(a.id));
  if (picked.length === 0) return null;
  const groups = new Map<string, string[]>();
  for (const addon of picked) {
    const group = addon.group?.trim() || "Add-ons";
    const names = groups.get(group) ?? [];
    names.push(addon.name);
    groups.set(group, names);
  }
  return [...groups.entries()].map(([group, names]) => `${group}: ${names.join(", ")}`).join(" · ");
}

export function composeLineNotes(
  item: OrderItemDraft,
  allToppings: AdminTopping[],
  allAddons: AdminAddon[],
): string | null {
  const parts = [composePizzaNotes(item, allToppings), composeAddonNotes(item, allAddons)].filter(
    (p): p is string => Boolean(p),
  );
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

function customDescription(item: OrderItemDraft): string | null {
  return item.kind === "CUSTOM" ? item.description.trim() || null : null;
}

export function validateOrderItems(items: OrderItemDraft[]): boolean {
  return orderItemsIssue(items) === null;
}

/** Short reason the first incomplete item blocks submit, or null when all are complete. */
export function orderItemsIssue(items: OrderItemDraft[]): string | null {
  for (const [i, it] of items.entries()) {
    const n = `Item #${i + 1}`;
    if (it.kind === "CATALOG" && !it.productId) return `${n}: pick a product`;
    if (it.productName.trim().length < 2) return `${n}: add a name`;
    if (!(Number(it.unitPrice) > 0)) return `${n}: add a price`;
    if (!(Number(it.qty) > 0)) return `${n}: add a quantity`;
    if (wantsCatalogSave(it) && !it.saveCategoryId) return `${n}: pick a category to save`;
  }
  return null;
}

export async function resolveReferenceImageUrls(item: OrderItemDraft): Promise<string[]> {
  if (item.kind === "CATALOG") return [];
  const uploaded: string[] = [];
  for (const file of item.refFiles) {
    uploaded.push((await uploadImage(file, "quote-reference")).publicUrl);
  }
  return [...item.keptImageUrls, ...uploaded].slice(0, MAX_REF_IMAGES);
}

export async function resolveReferenceImageUrl(item: OrderItemDraft): Promise<string | null> {
  const urls = await resolveReferenceImageUrls(item);
  return urls[0] ?? null;
}

export function toOrderLinkItemPayload(
  item: OrderItemDraft,
  referenceImageUrls: string[],
  flavours: Array<{ id: string; name: string }>,
  allToppings: AdminTopping[],
  allAddons: AdminAddon[] = [],
): OrderLinkItemPayload {
  const lineNotes = composeLineNotes(item, allToppings, allAddons);
  const messageHint = mergeInstructions(lineNotes, item.messageOnCake.trim() || "");

  return {
    kind: item.kind,
    productId: item.kind === "CATALOG" ? item.productId : null,
    productName: item.productName.trim(),
    sizeLabel: item.sizeLabel.trim() || null,
    sizeGrams: item.sizeGrams ? Number(item.sizeGrams) : null,
    flavourId: item.flavourId || null,
    flavourName: resolveFlavourName(item, flavours),
    referenceImageUrl: referenceImageUrls[0] ?? null,
    referenceImageUrls,
    messageHint,
    description: customDescription(item),
    customTemplate: item.kind === "CUSTOM" ? item.customTemplate : null,
    unitPrice: Number(item.unitPrice),
    addonIds: item.addonSelections,
    qty: Number(item.qty) || 1,
  };
}

export function toOfflineOrderItemPayload(
  item: OrderItemDraft,
  referenceImageUrls: string[],
  flavours: Array<{ id: string; name: string }>,
  allToppings: AdminTopping[],
  allAddons: AdminAddon[] = [],
): OfflineOrderItemPayload {
  const lineNotes = composeLineNotes(item, allToppings, allAddons);

  return {
    kind: item.kind,
    productId: item.kind === "CATALOG" ? item.productId : null,
    productName: item.productName.trim(),
    sizeLabel: item.sizeLabel.trim() || null,
    sizeGrams: item.sizeGrams ? Number(item.sizeGrams) : null,
    flavourId: item.flavourId || null,
    flavourName: resolveFlavourName(item, flavours),
    referenceImageUrl: referenceImageUrls[0] ?? null,
    referenceImageUrls,
    messageOnCake: item.messageOnCake.trim() || null,
    instructions: mergeInstructions(lineNotes, item.instructions),
    description: customDescription(item),
    unitPrice: Number(item.unitPrice),
    qty: Number(item.qty) || 1,
  };
}
