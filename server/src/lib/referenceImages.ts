export const MAX_REFERENCE_IMAGES = 5;

export function syncReferenceImages(
  urls?: Array<string | null | undefined> | null,
  fallback?: string | null,
): { referenceImageUrls: string[]; referenceImageUrl: string | null } {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of [...(urls ?? []), fallback]) {
    const url = raw?.trim();
    if (!url || seen.has(url)) continue;
    seen.add(url);
    out.push(url);
    if (out.length >= MAX_REFERENCE_IMAGES) break;
  }
  return { referenceImageUrls: out, referenceImageUrl: out[0] ?? null };
}

export function listedReferenceImages(item: {
  referenceImageUrls?: string[] | null;
  referenceImageUrl?: string | null;
}): string[] {
  return syncReferenceImages(item.referenceImageUrls, item.referenceImageUrl).referenceImageUrls;
}
