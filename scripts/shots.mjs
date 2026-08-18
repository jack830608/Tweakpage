import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

/**
 * Takes the store screenshots from the build a user would install.
 *
 * The extension follows the operating system's language, so an English listing needs a
 * copy of the build with no other locale to fall back to. Everything else — the fixture
 * server, the browser, the extension — is exactly what `pnpm e2e` uses.
 */
const ENGLISH_BUILD = '.output/chrome-mv3-en';

rmSync(ENGLISH_BUILD, { recursive: true, force: true });
cpSync('.output/chrome-mv3', ENGLISH_BUILD, { recursive: true });
rmSync(`${ENGLISH_BUILD}/_locales/zh_TW`, { recursive: true, force: true });

// The demo page lives with the docs; the fixture server is what serves it.
cpSync('docs/assets/demo-page.html', 'tests/e2e/fixtures-page/demo.html');
mkdirSync('docs/assets/store', { recursive: true });

try {
  execFileSync(
    'npx',
    ['playwright', 'test', '--config', 'playwright.shots.config.ts'],
    { stdio: 'inherit', env: { ...process.env, TWEAKPAGE_BUILD: ENGLISH_BUILD } },
  );
} finally {
  rmSync('tests/e2e/fixtures-page/demo.html', { force: true });
  rmSync(ENGLISH_BUILD, { recursive: true, force: true });
}
