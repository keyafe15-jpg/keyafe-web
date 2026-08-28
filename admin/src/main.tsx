import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "react-router-dom";
import "./index.css";
import { router } from "@/routes/router";
import { queryClient } from "@/lib/queryClient";
import { ensureServiceWorker } from "@/lib/push";

// Register the service worker as soon as we can — required for Web Push
// notifications when the app is closed. Failures are silent; the UI still
// works, only the push-permission button becomes a no-op.
void ensureServiceWorker();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
