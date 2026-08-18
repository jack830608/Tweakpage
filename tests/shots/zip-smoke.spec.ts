import { chromium, expect, test } from '@playwright/test';

/**
 * The package a reviewer would install, driven end to end.
 *
 * Not the build directory: the unzipped ZIP, because that is what gets submitted and a
 * packaging mistake is invisible until someone unpacks it.
 */
test('the unzipped package edits, persists and refuses to leak', async () => {
  const extensionPath = process.env.TWEAKPAGE_PACKAGE ?? '.output/package/unpacked';
  const context = await chromium.launchPersistentContext('', {
    channel: 'chromium',
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
  });
  const page = await context.newPage();
  await page.goto('http://localhost:4173/');

  let [worker] = context.serviceWorkers();
  if (!worker) worker = await context.waitForEvent('serviceworker');
  await worker.evaluate(async () => {
    const c = (globalThis as any).chrome;
    await c.storage.local.set({
      'tweakpage:onboarded': true,
      'tweakpage:share-settings': {
        bucket: 'demo-bucket', region: 'us-east-1',
        accessKeyId: 'AKIA_SENTINEL', secretAccessKey: 'SECRET_SENTINEL',
        tinypngKey: 'TINIFY_SENTINEL', compressImages: false,
        uploadImages: { summary: true, json: true, download: true, share: true },
      },
    });
    const [tab] = await c.tabs.query({ active: true, currentWindow: true });
    await c.tabs.sendMessage(tab.id, { type: 'tweakpage:toggle' });
  });

  // It edits.
  await page.locator('h1').click();
  await page.locator('[data-testid="text"]').fill('Edited by the packaged build');
  await expect(page.locator('h1')).toHaveText('Edited by the packaged build');

  // It persists.
  await page.reload();
  await expect(page.locator('h1')).toHaveText('Edited by the packaged build');
  await expect(page.locator('#tweakpage-marker button')).toBeVisible();

  // It does not leak, even with the settings open and a site poking at them.
  await page.locator('#tweakpage-marker button').click();
  await page.locator('[data-testid="open-settings"]').click();
  const leaked = await page.evaluate(async () => {
    const root = document.getElementById('tweakpage-host')?.shadowRoot;
    if (!root) return ['no shadow root — cannot even look'];
    for (const section of ['set-sharing', 'set-appearance']) {
      (root.querySelector(`[data-section="${section}"]`) as HTMLElement | null)?.click();
    }
    await new Promise((r) => setTimeout(r, 300));
    return ['SECRET_SENTINEL', 'TINIFY_SENTINEL', 'AKIA_SENTINEL'].filter((s) =>
      root.innerHTML.includes(s),
    );
  });
  expect(leaked, 'the packaged build must not hand a site its credentials').toEqual([]);
  await context.close();
});
