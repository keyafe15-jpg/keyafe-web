/**
 * Origin of the customer-facing storefront. Uses VITE_STOREFRONT_URL when set;
 * otherwise derives it from the admin's own address — admin.keyafe.com serves
 * keyafe.com, and locally the admin (5175–5179) pairs with the storefront on 5173.
 */
export function storefrontOrigin(): string {
  const configured = import.meta.env.VITE_STOREFRONT_URL as string | undefined;
  if (configured?.trim()) return configured.trim().replace(/\/+$/, "");

  const { protocol, hostname, port } = window.location;
  if (hostname.startsWith("admin.")) {
    return `${protocol}//${hostname.slice("admin.".length)}`;
  }
  const storefrontPort = /^517[5-9]$/.test(port) ? "5173" : port;
  return `${protocol}//${hostname}${storefrontPort ? `:${storefrontPort}` : ""}`;
}

/** Public page where the customer completes an order link. */
export function orderLinkUrl(token: string): string {
  return `${storefrontOrigin()}/o/${token}`;
}
