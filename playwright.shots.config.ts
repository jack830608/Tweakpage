import { defineConfig } from '@playwright/test';

/** Store screenshots: same fixture server as the E2E suite, different test directory. */
export default defineConfig({
  testDir: 'tests/shots',
  timeout: 60_000,
  webServer: {
    command: 'python3 -m http.server 4173 -d tests/e2e/fixtures-page',
    url: 'http://localhost:4173',
    reuseExistingServer: true,
  },
});
