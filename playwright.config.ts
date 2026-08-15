import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 30_000,
  webServer: {
    command: 'python3 -m http.server 4173 -d tests/e2e/fixtures-page',
    url: 'http://localhost:4173',
    reuseExistingServer: true,
  },
});
