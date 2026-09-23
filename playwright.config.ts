import { defineConfig, devices } from "@playwright/test";

const E2E_DATABASE_URL =
  process.env.E2E_DATABASE_URL ??
  "postgresql://keyafe:keyafeDevPass@127.0.0.1:5432/keyafe_e2e?schema=public";

const apiEnv = {
  ...process.env,
  DATABASE_URL: E2E_DATABASE_URL,
  NODE_ENV: "development",
  // Force SMS stub so tests don't burn MSG91 credits or depend on KYC.
  MSG91_AUTH_KEY: "",
  MSG91_SENDER_ID: "",
  MSG91_OTP_TEMPLATE_ID: "",
  MSG91_SEND_VIA: "otp",
  ADMIN_BOOTSTRAP_PHONE: "9883186892",
  CLIENT_ORIGIN: "http://127.0.0.1:5173",
  ADMIN_ORIGIN: "http://127.0.0.1:5175",
};

export default defineConfig({
  testDir: "./e2e/tests",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  globalSetup: "./e2e/global-setup.mjs",
  use: {
    baseURL: "http://127.0.0.1:5173",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: [
    {
      // Reset+seed DB then start API (Playwright starts webServer before globalSetup).
      command: "node e2e/start-api.mjs",
      url: "http://127.0.0.1:4000/api/health",
      // Always use the e2e env (no MSG91) — don't attach to a leftover dev server.
      reuseExistingServer: false,
      timeout: 180_000,
      env: apiEnv,
    },
    {
      command: "pnpm --filter client exec vite --host 127.0.0.1 --port 5173",
      url: "http://127.0.0.1:5173",
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: "pnpm --filter admin exec vite --host 127.0.0.1 --port 5175",
      url: "http://127.0.0.1:5175",
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
