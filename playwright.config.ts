import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  // Playwright parallelises by file, and all 71 of these live in one. Without this the
  // suite runs on a single worker everywhere — fine on a laptop, 20x slower on a shared
  // runner. The tests build their own context each, so they do not need the isolation
  // a single worker was accidentally giving them.
  fullyParallel: true,
  workers: process.env.CI ? 2 : undefined,
  // A hand-off can upload an image, wait for the object, and replay it in a second
  // profile. Thirty seconds was enough on a quiet machine and nothing else.
  timeout: 60_000,
  // Assertions get longer than Playwright's 5s default because a toast lives for exactly
  // 5s. A machine busy enough to take that long to copy something raced its own success
  // message and reported "element(s) not found" — the operation had not failed, the
  // window to see it say so had closed. Nothing here is weakened: an assertion still has
  // to hold, it is just allowed to hold late.
  expect: { timeout: 15_000 },
  webServer: {
    command: 'python3 -m http.server 4173 -d tests/e2e/fixtures-page',
    url: 'http://localhost:4173',
    reuseExistingServer: true,
  },
});
