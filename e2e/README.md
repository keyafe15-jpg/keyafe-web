# Playwright E2E smokes

Uses a separate Postgres database `keyafe_e2e` on the same Docker instance as local dev.

## Prerequisites

```bash
pnpm db:up
pnpm exec playwright install chromium   # once
```

## Run

```bash
pnpm test:e2e
pnpm test:e2e:ui        # interactive
pnpm test:e2e:report    # last HTML report
```

`e2e/start-api.mjs` (API webServer command) recreates `keyafe_e2e`, runs migrations + seed, upserts coupon `E2E10`, then starts the API. Playwright starts webServers *before* globalSetup, so DB reset must live with the API process — otherwise `DROP DATABASE` kills Prisma (P1017).

MSG91 env is cleared for the API under test so OTP stays in the JSON response (no SMS).
