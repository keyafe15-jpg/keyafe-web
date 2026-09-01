// Keyafe admin service worker — handles Web Push and click-to-open.
// Keep this file at the root of `admin/public/` so it can be registered
// against the entire `/` scope.

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload = {};
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "New order", body: event.data.text() };
  }

  const title = payload.title || "New order";
  const options = {
    body: payload.body || "",
    icon: "/logo.png",
    badge: "/logo.png",
    tag: payload.orderNumber || "keyafe-order",
    // Keep the notification on-screen until the user interacts. Some browsers
    // ignore this on their platform but honour it on desktop.
    requireInteraction: payload.type !== "order-cancelled",
    data: {
      orderNumber: payload.orderNumber,
      source: payload.source,
      url: payload.orderNumber ? `/orders/${payload.orderNumber}` : "/orders",
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/orders";

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      // If an admin tab is already open, focus it and route it there.
      for (const client of allClients) {
        if (client.url.includes(self.location.origin)) {
          await client.focus();
          if ("navigate" in client) {
            try {
              await client.navigate(url);
            } catch {
              // Cross-origin navigations can fail — fall through to openWindow.
            }
          }
          return;
        }
      }

      // Otherwise open a new tab straight to the order.
      if (self.clients.openWindow) {
        await self.clients.openWindow(url);
      }
    })(),
  );
});
