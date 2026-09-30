const BASE = "/api";

let accessToken: string | null = null;
let sessionEnding = false;

/** Cleared session → redirect. Wired from the auth store to avoid a circular import. */
type UnauthorizedHandler = () => void;
let unauthorizedHandler: UnauthorizedHandler | null = null;

/**
 * Exchanges the stored refresh token for a new access token. Resolves null only when
 * the server rejects the session; throws on network/server errors so a blip never logs staff out.
 */
type SessionRefresher = () => Promise<string | null>;
let sessionRefresher: SessionRefresher | null = null;
let refreshInFlight: Promise<string | null> | null = null;

export function setAdminAccessToken(token: string | null) {
  accessToken = token;
  if (token) sessionEnding = false;
}

export function getAdminAccessToken(): string | null {
  return accessToken;
}

export function setUnauthorizedHandler(handler: UnauthorizedHandler) {
  unauthorizedHandler = handler;
}

export function setSessionRefresher(refresher: SessionRefresher) {
  sessionRefresher = refresher;
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

// Auth routes that need a signed-in user still get the refresh-and-retry treatment.
const SIGNED_IN_AUTH_PATHS = new Set(["/auth/password"]);

function isAuthPath(path: string): boolean {
  if (SIGNED_IN_AUTH_PATHS.has(path)) return false;
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

/** Concurrent 401s share one refresh call. */
function refreshSession(): Promise<string | null> {
  if (!sessionRefresher) return Promise.resolve(null);
  refreshInFlight ??= sessionRefresher().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

function tokenExpiresWithin(token: string, ms: number): boolean {
  try {
    const payload = token.split(".")[1]!.replace(/-/g, "+").replace(/_/g, "/");
    const { exp } = JSON.parse(atob(payload)) as { exp?: number };
    return typeof exp === "number" && exp * 1000 - Date.now() < ms;
  } catch {
    return false;
  }
}

/**
 * Renews the access token if it has expired (or is about to). For long-lived
 * connections like the order stream, which never see a 401 from `request`.
 */
export async function renewSessionIfExpiring(): Promise<void> {
  if (!accessToken || !tokenExpiresWithin(accessToken, 60_000)) return;
  let fresh: string | null;
  try {
    fresh = await refreshSession();
  } catch {
    return;
  }
  if (fresh === null) {
    try {
      endExpiredSession();
    } catch {
      // endExpiredSession always throws; the redirect is what matters here.
    }
  }
}

function authHeader(): Record<string, string> {
  return accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
}

/**
 * Sends the request; on a 401 from a non-auth route, refreshes the session once and
 * retries. Only when the refresh fails does the user get sent to /login.
 */
async function fetchWithSession(path: string, buildInit: () => RequestInit): Promise<Response> {
  const sentWith = accessToken;
  const res = await fetch(`${BASE}${path}`, buildInit());
  if (res.status !== 401 || isAuthPath(path)) return res;

  // Another request may already have refreshed while this one was in flight.
  const fresh = accessToken && accessToken !== sentWith ? accessToken : await refreshSession();
  if (!fresh) endExpiredSession();

  const retry = await fetch(`${BASE}${path}`, buildInit());
  if (retry.status === 401) endExpiredSession();
  return retry;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetchWithSession(path, () => ({
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...authHeader(),
      ...(init?.headers ?? {}),
    },
    credentials: "include",
  }));

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
  headers: Headers;
}

// Separate from `request` because that one always parses JSON, and file
// downloads need the raw body plus the response headers.
async function requestBlob(path: string): Promise<BlobResponse> {
  const res = await fetchWithSession(path, () => ({
    headers: authHeader(),
    credentials: "include",
  }));

  if (!res.ok) {
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
  const res = await fetchWithSession(path, () => ({
    method: "POST",
    headers: authHeader(),
    credentials: "include",
    body: form,
  }));

  if (!res.ok) {
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
  delete: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: "DELETE",
      body: body ? JSON.stringify(body) : undefined,
    }),
};
