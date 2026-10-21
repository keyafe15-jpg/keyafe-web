import { prisma } from "../../config/db.js";
import { parseLineNotes, splitCakeMessage, extrasPlainText } from "../../lib/lineExtras.js";
import { ensureAddonShopProducts } from "../addons/addon-shop.service.js";

const PIZZA_SPEC_GROUPS = new Set(["crust", "toppings", "condiments"]);

export type LinkAddon = {
  id: string;
  name: string;
  group: string | null;
  priceDelta: number;
  productId: string | null;
};

export async function loadActiveAddons(): Promise<LinkAddon[]> {
  const missing = await prisma.addon.findMany({
    where: { productId: null, isActive: true },
    select: { id: true },
  });
  if (missing.length) await ensureAddonShopProducts(missing.map((a) => a.id));

  const rows = await prisma.addon.findMany({
    where: { isActive: true },
    orderBy: [{ group: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true, group: true, priceDelta: true, productId: true },
  });
  return rows.map((a) => ({
    id: a.id,
    name: a.name,
    group: a.group,
    priceDelta: Number(a.priceDelta),
    productId: a.productId,
  }));
}

export function matchAddonIdsFromHint(hint: string | null | undefined, catalog: LinkAddon[]): string[] {
  if (!hint?.trim() || catalog.length === 0) return [];
  const names = new Set<string>();
  const fromSplit = splitCakeMessage(hint);
  const fromNotes = parseLineNotes(hint);
  for (const extra of [...fromSplit.extras, ...fromNotes.extras]) {
    if (PIZZA_SPEC_GROUPS.has(extra.group.trim().toLowerCase())) continue;
    for (const name of extra.names.split(",")) names.add(name.trim().toLowerCase());
  }
  if (names.size === 0) return [];
  return catalog.filter((a) => names.has(a.name.trim().toLowerCase())).map((a) => a.id);
}

export function staffAddonIds(
  item: { addonIds?: string[] | null; messageHint?: string | null },
  catalog: LinkAddon[],
): string[] {
  if (item.addonIds && item.addonIds.length > 0) return item.addonIds;
  return matchAddonIdsFromHint(item.messageHint, catalog);
}

export function addonDelta(ids: string[], byId: Map<string, LinkAddon>): number {
  return ids.reduce((sum, id) => sum + (byId.get(id)?.priceDelta ?? 0), 0);
}

export function publicAddons(ids: string[], byId: Map<string, LinkAddon>): {
  id: string;
  name: string;
  group: string | null;
  priceDelta: number;
}[] {
  return ids
    .map((id) => byId.get(id))
    .filter((a): a is LinkAddon => !!a)
    .map((a) => ({ id: a.id, name: a.name, group: a.group, priceDelta: a.priceDelta }));
}

/** Pizza crust/toppings and leftover notes stay on the cake line; extras become their own rows. */
export function leftoverInstructions(messageHint: string | null | undefined): string | null {
  if (!messageHint?.trim()) return null;
  const cake = splitCakeMessage(messageHint).message;
  const parsed = parseLineNotes(messageHint);
  const spec = parsed.extras.filter((e) => PIZZA_SPEC_GROUPS.has(e.group.trim().toLowerCase()));
  const notes = parsed.notes && parsed.notes !== cake ? parsed.notes : null;
  const parts = [spec.length ? extrasPlainText(spec) : null, notes].filter(Boolean);
  return parts.length ? parts.join("\n") : null;
}

export function hintCakeMessage(messageHint: string | null | undefined): string | null {
  return splitCakeMessage(messageHint).message;
}
