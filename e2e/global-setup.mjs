/**
 * Playwright globalSetup runs *after* webServers start.
 * DB reset + seed live in e2e/start-api.mjs (API webServer command).
 */
export default async function globalSetup() {
  // no-op — kept so config has a stable hook for future shared fixtures
}
