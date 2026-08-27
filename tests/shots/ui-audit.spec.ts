import path from 'node:path';
import { chromium, test, type BrowserContext, type Page } from '@playwright/test';

/** Throwaway: renders the panel in the states a person actually meets, to be looked at. */
const OUT = process.env.TWEAKPAGE_UI_OUT ?? 'test-results/ui';
const SIZE = { width: 1280, height: 900 };

async function editor(theme: 'light' | 'dark'): Promise<{ context: BrowserContext; page: Page }> {
  const ext = process.env.TWEAKPAGE_BUILD ?? path.resolve('.output/chrome-mv3');
  const context = await chromium.launchPersistentContext('', {
    channel: 'chromium',
    args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`],
    viewport: SIZE,
    colorScheme: theme,
  });
  const page = await context.newPage();
  await page.goto('http://localhost:4173/demo.html');
  let [worker] = context.serviceWorkers();
  if (!worker) worker = await context.waitForEvent('serviceworker');
  await worker.evaluate(async () => {
    const c = (globalThis as any).chrome;
    await c.storage.local.set({ 'tweakpage:onboarded': true });
    const [tab] = await c.tabs.query({ active: true, currentWindow: true });
    await c.tabs.sendMessage(tab.id, { type: 'tweakpage:toggle' });
  });
  await page.waitForTimeout(300);
  return { context, page };
}

async function shot(page: Page, name: string, hover = false) {
  const panel = page.locator('.twk-panel');
  if (hover) await panel.hover();
  else await page.mouse.move(640, 450);
  await page.waitForTimeout(250);
  await panel.screenshot({ path: `${OUT}/${name}.png` });
}

for (const theme of ['light', 'dark'] as const) {
  test(`idle — ${theme}`, async () => {
    const { context, page } = await editor(theme);
    await shot(page, `idle-${theme}`);
    await context.close();
  });

  test(`selected — ${theme}`, async () => {
    const { context, page } = await editor(theme);
    await page.locator('h1').click();
    await shot(page, `selected-${theme}`);
    await shot(page, `selected-${theme}-hover`, true);
    await context.close();
  });

  test(`sections open — ${theme}`, async () => {
    const { context, page } = await editor(theme);
    await page.locator('h1').click();
    const s = page.locator('[data-section="typography"]');
    if ((await s.getAttribute('aria-expanded')) !== 'true') await s.click();
    await page.waitForTimeout(200);
    await shot(page, `sections-${theme}`);
    await context.close();
  });

  test(`shared preview — ${theme}`, async () => {
    const ext = process.env.TWEAKPAGE_BUILD ?? path.resolve('.output/chrome-mv3');
    const context = await chromium.launchPersistentContext('', {
      channel: 'chromium',
      args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`],
      viewport: SIZE,
      colorScheme: theme,
    });
    await context.route('https://**.amazonaws.com/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          version: 1,
          url: 'http://localhost:4173/demo.html',
          title: 'Demo',
          updatedAt: '2026-08-28T00:00:00.000Z',
          records: [{
            id: 'sh1', selector: 'h1', fallbackSelectors: [], elementLabel: 'h1',
            type: 'text', property: 'textContent',
            oldValue: 'Make the page yours', newValue: '同事提議的新標題',
            enabled: true,
            createdAt: '2026-08-28T00:00:00.000Z', updatedAt: '2026-08-28T00:00:00.000Z',
          }],
        }),
      }),
    );
    const page = await context.newPage();
    await page.goto('http://localhost:4173/demo.html?tweakpage=abc123_demo-bucket_ap-northeast-1');
    await page.waitForTimeout(1200);
    await shot(page, `shared-${theme}`);
    await context.close();
  });

  test(`change list — ${theme}`, async () => {
    const { context, page } = await editor(theme);
    await page.locator('h1').click();
    await page.locator('[data-testid="text"]').fill('A headline somebody proposed');
    await page.locator('p.lead').click();
    await page.locator('[data-testid="text"]').fill('And a second change underneath it');
    await page.locator('[data-testid="review"]').click().catch(() => {});
    await page.waitForTimeout(300);
    await shot(page, `changes-${theme}`);
    await context.close();
  });
}
