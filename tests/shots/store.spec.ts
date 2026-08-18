import path from 'node:path';
import { chromium, expect, test, type BrowserContext } from '@playwright/test';

/**
 * The store screenshots, taken from the running extension.
 *
 * Listing images are a claim about the product, and a hand-made one goes stale the first
 * time a button moves. These are generated, at the exact size the dashboard wants, from
 * the same build a user installs — so a screenshot that no longer matches is a failing
 * command rather than a rejected submission.
 *
 * The extension follows the OS language, so English comes from a build copy with no
 * other locale to offer (see `pnpm shots`).
 */
const OUT = 'docs/assets/store';
const SIZE = { width: 1280, height: 800 };

async function editor(): Promise<{ context: BrowserContext }> {
  const extensionPath = process.env.TWEAKPAGE_BUILD ?? path.resolve('.output/chrome-mv3');
  const context = await chromium.launchPersistentContext('', {
    channel: 'chromium',
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
    viewport: SIZE,
  });
  return { context };
}

async function open(context: BrowserContext, url: string) {
  const page = await context.newPage();
  await page.setViewportSize(SIZE);
  await page.goto(url);
  let [worker] = context.serviceWorkers();
  if (!worker) worker = await context.waitForEvent('serviceworker');
  await worker.evaluate(async () => {
    const c = (globalThis as any).chrome;
    await c.storage.local.set({ 'tweakpage:onboarded': true });
    const [tab] = await c.tabs.query({ active: true, currentWindow: true });
    await c.tabs.sendMessage(tab.id, { type: 'tweakpage:toggle' });
  });
  return page;
}

test('1 — select and edit', async () => {
  const { context } = await editor();
  const page = await open(context, 'http://localhost:4173/demo.html');
  await page.locator('h1').click();
  const typography = page.locator('[data-section="typography"]');
  if ((await typography.getAttribute('aria-expanded')) !== 'true') await typography.click();
  await page.locator('[data-testid="font-size"]').fill('54');
  await page.locator('h1').click();
  await page.mouse.move(1100, 400);
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/1-edit.png` });
  await context.close();
});

test('2 — compare with the original', async () => {
  const { context } = await editor();
  const page = await open(context, 'http://localhost:4173/demo.html');
  await page.locator('p.lead').click();
  await page.locator('[data-testid="text"]').fill(
    'Try the change before you ask anyone to build it. Edit, compare, hand it off.',
  );
  await page.locator('[data-testid="mode-original"]').click();
  await page.mouse.move(1100, 400);
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/2-compare.png` });
  await context.close();
});

test('3 — the change list an engineer receives', async () => {
  const { context } = await editor();
  const page = await open(context, 'http://localhost:4173/demo.html');
  await page.locator('p.lead').click();
  await page.locator('[data-testid="text"]').fill(
    'Try the change before you ask anyone to build it.',
  );
  const typography = page.locator('[data-section="typography"]');
  if ((await typography.getAttribute('aria-expanded')) !== 'true') await typography.click();
  await page.locator('[data-testid="font-size"]').fill('54');
  await page.locator('[data-testid="review-changes"]').click();
  await page.locator('.twk-change-note').first().fill('Legal asked for the shorter line');
  await page.locator('.twk-change-note').first().blur();
  await page.mouse.move(1100, 400);
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/3-review.png` });
  await context.close();
});

test('4 — reorder and duplicate', async () => {
  const { context } = await editor();
  const page = await open(context, 'http://localhost:4173/demo.html');
  await page.locator('.cta').click();
  await expect(page.locator('[data-testid="duplicate-element"]')).toBeVisible();
  await page.mouse.move(1100, 400);
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/4-structure.png` });
  await context.close();
});
