import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  optimizeDeps: {
    include: ["@googlemaps/js-api-loader"],
    exclude: ["@keyafe/shared"],
  },
  server: {
    port: 5173,
    fs: { allow: [".."] },
    allowedHosts: ["localhost", "127.0.0.1", "unmoved-demote-stunned.ngrok-free.dev"],
    proxy: {
      "/api": "http://localhost:4000",
    },
  },
});
