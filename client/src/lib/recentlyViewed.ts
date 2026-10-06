const STORAGE_KEY = "keyafe-recent";
const MAX_ITEMS = 12;

/**
 * What the home page needs to show a recently viewed tile. Prices are left out
 * on purpose: a stored price would go stale, and the product page shows the
 * current one.
 */
export interface RecentProduct {
  slug: string;
  name: string;
  image: string | null;
  category: string | null;
  isEggless: boolean;
}

export function readRecentProducts(): RecentProduct[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.filter((p): p is RecentProduct => typeof p?.slug === "string" && !!p.name)
      : [];
  } catch {
    return [];
  }
}

/** Newest first, one entry per product. */
export function rememberRecentProduct(product: RecentProduct) {
  try {
    const next = [product, ...readRecentProducts().filter((p) => p.slug !== product.slug)];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next.slice(0, MAX_ITEMS)));
  } catch {
    // Storage can be full or blocked (private mode); the rail is a nicety.
  }
}

export function clearRecentProducts() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // See rememberRecentProduct.
  }
}
