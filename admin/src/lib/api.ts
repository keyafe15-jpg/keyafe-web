const BASE = "/api";

let accessToken: string | null = null;
let sessionEnding = false;

/** Cleared session → redirect. Wired from the auth store to avoid a circular import. */
type UnauthorizedHandler = () => void;
let unauthorizedHandler: UnauthorizedHandler | null = null;

export function setAdminAccessToken(token: string | null) {
  accessToken = token;
  if (token) sessionEnding = false;
}

export function setUnauthorizedHandler(handler: UnauthorizedHandler) {
  unauthorizedHandler = handler;
}

/** Thrown after a 401 so callers don't treat the request as successful. Message is empty so UIs don't flash "Invalid or expired session". */
export class SessionExpiredError extends Error {
  readonly isSessionExpired = true as const;
  constructor() {
    super("");
    this.name = "SessionExpiredError";
  }
}

export function isSessionExpiredError(err: unknown): boolean {
  return (
    err instanceof SessionExpiredError ||
    (typeof err === "object" &&
      err !== null &&
      "isSessionExpired" in err &&
      (err as { isSessionExpired?: boolean }).isSessionExpired === true)
  );
}

function isAuthPath(path: string): boolean {
  return path === "/auth" || path.startsWith("/auth/");
}

function endExpiredSession(): never {
  if (!sessionEnding) {
    sessionEnding = true;
    setAdminAccessToken(null);
    unauthorizedHandler?.();
    if (!window.location.pathname.startsWith("/login")) {
      window.location.replace("/login");
    }
  }
  throw new SessionExpiredError();
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...(init?.headers ?? {}),
    },
    credentials: "include",
  });

  if (!res.ok) {
    // Login OTP failures are also 401 — leave those alone so the form can show them.
    if (res.status === 401 && !isAuthPath(path)) {
      endExpiredSession();
    }
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export interface BlobResponse {
  blob: Blob;
  /** Filename from Content-Disposition, when the server sent one. */
  filename: string | null;
  headers: Headers;
}

// Separate from `request` because that one always parses JSON, and file
// downloads need the raw body plus the response headers.
async function requestBlob(path: string): Promise<BlobResponse> {
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    credentials: "include",
  });

  if (!res.ok) {
    if (res.status === 401 && !isAuthPath(path)) {
      endExpiredSession();
    }
    // Errors still come back as JSON even on a blob endpoint.
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Request failed: ${res.status}`);
  }

  const disposition = res.headers.get("Content-Disposition") ?? "";
  const match = /filename="?([^"]+)"?/.exec(disposition);

  return {
    blob: await res.blob(),
    filename: match?.[1] ?? null,
    headers: res.headers,
  };
}

async function requestForm<T>(path: string, form: FormData): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: {
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    credentials: "include",
    body: form,
  });

  if (!res.ok) {
    if (res.status === 401 && !isAuthPath(path)) {
      endExpiredSession();
    }
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  getBlob: (path: string) => requestBlob(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    }),
  postForm: <T>(path: string, form: FormData) => requestForm<T>(path, form),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: "PATCH",
      body: body ? JSON.stringify(body) : undefined,
    }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};
