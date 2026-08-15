import fs from 'node:fs';
import { expect } from '@playwright/test';
import { activateEditor, test } from './fixtures';

test('edit → persist → replay → export', async ({ context }) => {
  const page = await context.newPage();
  await page.goto('http://localhost:4173/');

  await activateEditor(context);
  await expect(page.locator('#pg-visual-editor-host aside')).toBeVisible();

  await page.locator('h1').click();
  await page.getByLabel('Text', { exact: true }).fill('New headline');
  await expect(page.locator('h1')).toHaveText('New headline');

  await page.getByLabel('Color hex', { exact: true }).fill('#ff0000');
  await expect(page.locator('h1')).toHaveCSS('color', 'rgb(255, 0, 0)');

  await page.reload();
  await expect(page.locator('h1')).toHaveText('New headline');
  await expect(page.locator('h1')).toHaveCSS('color', 'rgb(255, 0, 0)');

  await activateEditor(context);
  await page.getByRole('button', { name: /^Changes/ }).click();
  await page.getByRole('button', { name: 'Export JSON' }).click();

  // Export JSON is delivered via chrome.downloads from the background service worker (a
  // blob: URL created in the content script's isolated world can't be resolved for a real
  // download, and chrome.downloads is not available to content scripts at all). Chrome does
  // not associate a service-worker-initiated download with any tab/frame, so Playwright's
  // page-scoped `download` event never fires for it — read the completed download back
  // through the downloads API instead.
  const [worker] = context.serviceWorkers();
  const filename = await worker.evaluate(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const c = (globalThis as any).chrome;
    const deadline = Date.now() + 10_000;
    while (Date.now() < deadline) {
      const items = await c.downloads.search({});
      const done = items.find((i: { state: string }) => i.state === 'complete');
      if (done) return done.filename as string;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error('download did not complete in time');
  });
  const exported = JSON.parse(fs.readFileSync(filename, 'utf8'));
  expect(exported.version).toBe(1);
  expect(exported.records).toHaveLength(2);
});

test('spacing box-model editor fits inside the panel', async ({ context }) => {
  const page = await context.newPage();
  await page.goto('http://localhost:4173/');
  await activateEditor(context);
  await page.locator('h1').click();

  const inputBox = (await page.getByLabel('padding top').boundingBox())!;
  expect(inputBox.width).toBeLessThan(60);

  const panelBox = (await page.locator('#pg-visual-editor-host aside').boundingBox())!;
  const marginBox = (await page.locator('.pgve-box--margin').boundingBox())!;
  const paddingBox = (await page.locator('.pgve-box--padding').boundingBox())!;
  expect(paddingBox.x + paddingBox.width).toBeLessThanOrEqual(marginBox.x + marginBox.width + 1);
  expect(marginBox.x + marginBox.width).toBeLessThanOrEqual(panelBox.x + panelBox.width + 1);
});
