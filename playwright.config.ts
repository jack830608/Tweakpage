import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  // Playwright parallelises by file, and all 71 of these live in one. Without this the
  // suite runs on a single worker everywhere — fine on a laptop, 20x slower on a shared
  // runner. The tests build their own context each, so they do not need the isolation
  // a single worker was accidentally giving them.
  fullyParallel: true,
  workers: process.env.CI ? 2 : undefined,
  timeout: 30_000,
  webServer: {
    command: 'python3 -m http.server 4173 -d tests/e2e/fixtures-page',
    url: 'http://localhost:4173',
    reuseExistingServer: true,
  },
});
