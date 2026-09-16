const BASE = "/api";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    credentials: "include",
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export interface BlobResponse {
  blob: Blob;
  /** Filename from Content-Disposition, when the server sent one. */
  filename: string | null;
}

// Separate from `request` because that one always parses JSON, and file
// downloads need the raw body plus the response headers.
async function requestBlob(path: string): Promise<BlobResponse> {
  const res = await fetch(`${BASE}${path}`, { credentials: "include" });

  if (!res.ok) {
    // Errors still come back as JSON even on a blob endpoint.
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Request failed: ${res.status}`);
  }

  const disposition = res.headers.get("Content-Disposition") ?? "";
  const match = /filename="?([^"]+)"?/.exec(disposition);
  return { blob: await res.blob(), filename: match?.[1] ?? null };
}

export const api = {
  get: <T>(path: string, init?: RequestInit) => request<T>(path, init),
  getBlob: (path: string) => requestBlob(path),
  post: <T>(path: string, body?: unknown, init?: RequestInit) =>
    request<T>(path, {
      ...init,
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    }),
  patch: <T>(path: string, body?: unknown, init?: RequestInit) =>
    request<T>(path, {
      ...init,
      method: "PATCH",
      body: body ? JSON.stringify(body) : undefined,
    }),
  delete: <T>(path: string, init?: RequestInit) =>
    request<T>(path, { ...init, method: "DELETE" }),
};
