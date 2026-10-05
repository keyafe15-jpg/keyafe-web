export const flavorGroupSelect = { select: { name: true, sortOrder: true } } as const;

/** Storefront shape: `group` is the heading name, `groupOrder` sorts the headings. */
export function flattenFlavorGroup<T extends { group: { name: string; sortOrder: number } | null }>(
  row: T,
) {
  const { group, ...rest } = row;
  return { ...rest, group: group?.name ?? null, groupOrder: group?.sortOrder ?? null };
}
