import { api } from "@/lib/api";

const SUB_STORAGE_KEY = "keyafe-admin-push-endpoint";

// URL-safe base64 → Uint8Array (the format Push subscriptions expect).
function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const buf = new ArrayBuffer(raw.length);
  const out = new Uint8Array(buf);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export interface PushState {
  supported: boolean;
  permission: NotificationPermission | "unsupported";
  subscribed: boolean;
}

export function getPushState(): PushState {
  const supported =
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window;
  if (!supported) {
    return { supported: false, permission: "unsupported", subscribed: false };
  }
  return {
    supported: true,
    permission: Notification.permission,
    subscribed: !!localStorage.getItem(SUB_STORAGE_KEY),
  };
}

export async function ensureServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  try {
    const reg =
      (await navigator.serviceWorker.getRegistration("/")) ??
      (await navigator.serviceWorker.register("/sw.js", { scope: "/" }));
    await navigator.serviceWorker.ready;
    return reg;
  } catch {
    return null;
  }
}

// Full "enable notifications" flow — permission → SW → subscribe → POST.
export async function enablePush(): Promise<PushState> {
  const state = getPushState();
  if (!state.supported) return state;

  if (Notification.permission === "default") {
    await Notification.requestPermission();
  }
  if (Notification.permission !== "granted") return getPushState();

  const reg = await ensureServiceWorker();
  if (!reg) return getPushState();

  const { publicKey } = await api.get<{ publicKey: string }>(
    "/admin/push/vapid-public-key",
  );

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
  }

  const raw = sub.toJSON();
  await api.post("/admin/push/subscribe", {
    endpoint: raw.endpoint,
    keys: raw.keys,
    userAgent: navigator.userAgent,
  });
  localStorage.setItem(SUB_STORAGE_KEY, raw.endpoint ?? "");

  return getPushState();
}

export async function disablePush(): Promise<PushState> {
  const reg = await ensureServiceWorker();
  if (reg) {
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      const endpoint = sub.endpoint;
      try {
        await sub.unsubscribe();
      } catch {
        // Ignore — we still want to tell the server.
      }
      await api.post("/admin/push/unsubscribe", { endpoint }).catch(() => {});
    }
  }
  localStorage.removeItem(SUB_STORAGE_KEY);
  return getPushState();
}
