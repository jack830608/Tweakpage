import { configDefaults, defineConfig } from 'vitest/config';
import { WxtVitest } from 'wxt/testing';

export default defineConfig({
  plugins: [WxtVitest()],
  test: {
    environment: 'happy-dom',
    // tests/ holds the Playwright suites: same filename pattern, different runner.
    exclude: [...configDefaults.exclude, 'tests/**', '**/.worktrees/**'],
  },
});
