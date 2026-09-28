import { HttpError } from "../utils/httpError.js";

/**
 * Accepts a same-site path ("/pan-india") or an absolute http(s) URL.
 * Blank → null. Anything else (javascript:, protocol-relative //, …) is rejected.
 */
export function sanitizeSiteLink(raw: string | null | undefined): string | null {
  const value = raw?.trim() || null;
  if (!value) return null;
  if (value.startsWith("/") && !value.startsWith("//")) return value;
  try {
    const url = new URL(value);
    if (url.protocol === "http:" || url.protocol === "https:") {
      return url.toString();
    }
  } catch {
    // fall through
  }
  throw HttpError.badRequest("Link must be a site path like /pan-india or a https URL.");
}
