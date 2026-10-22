import { useEffect, useRef } from "react";

const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

type Envelope<T> = { savedAt: number; data: T };

function readEnvelope<T>(key: string): Envelope<T> | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Envelope<T>;
    if (!parsed || typeof parsed !== "object" || typeof parsed.savedAt !== "number") return null;
    if (Date.now() - parsed.savedAt > MAX_AGE_MS) {
      localStorage.removeItem(key);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function readDraft<T>(key: string): T | null {
  return readEnvelope<T>(key)?.data ?? null;
}

export function writeDraft(key: string, data: unknown): void {
  if (typeof localStorage === "undefined") return;
  try {
    const envelope: Envelope<unknown> = { savedAt: Date.now(), data };
    localStorage.setItem(key, JSON.stringify(envelope));
  } catch {
    // Quota or private mode — staff can still finish the form this session.
  }
}

export function clearDraft(key: string): void {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(key);
}

/** Skip the first run so hydrating a draft does not immediately rewrite it. */
export function useDebouncedDraftSave(key: string, value: unknown, enabled = true): void {
  const skipFirst = useRef(true);
  useEffect(() => {
    if (!enabled) return;
    if (skipFirst.current) {
      skipFirst.current = false;
      return;
    }
    const timer = window.setTimeout(() => writeDraft(key, value), 300);
    return () => window.clearTimeout(timer);
  }, [key, value, enabled]);
}
