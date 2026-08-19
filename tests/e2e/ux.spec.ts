import { activateEditor, test } from './fixtures';

const OUT = 'test-results/ux';

test('ux shots', async ({ context }) => {
  const page = await context.newPage();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('http://localhost:4173/');
  const [w] = context.serviceWorkers().length ? context.serviceWorkers() : [await context.waitForEvent('serviceworker')];
  const panel = page.locator('#tweakpage-host aside');
  const shot = async (name: string, loc = panel) => loc.screenshot({ path: `${OUT}/${name}.png` });

  // 1 — onboarding, the very first thing anyone sees
  await w.evaluate(async () => {
    const c = (globalThis as any).chrome;
    await c.storage.local.remove('tweakpage:onboarded');
    const [t] = await c.tabs.query({ active: true, currentWindow: true });
    await c.tabs.sendMessage(t.id, { type: 'tweakpage:toggle' });
  });
  await panel.waitFor();
  await page.waitForTimeout(400);
  await shot('01-onboarding');

  await page.locator('.twk-onboarding button').click();
  await page.waitForTimeout(300);
  await shot('02-panel-empty');

  // 3 — hovering something, and 4 — selected
  await page.locator('#promo').hover();
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${OUT}/03-hover.png`, clip: { x: 0, y: 0, width: 900, height: 300 } });
  await page.locator('#promo').click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/04-selected.png`, clip: { x: 0, y: 0, width: 900, height: 300 } });
  await shot('05-panel-selected');

  // 6 — every section open at once
  for (const id of ['typography', 'colour', 'spacing', 'layout', 'border', 'advanced', 'image', 'link']) {
    const header = page.locator(`[data-section="${id}"]`);
    if (await header.count()) {
      if ((await header.getAttribute('aria-expanded')) !== 'true') await header.click();
    }
  }
  await page.waitForTimeout(300);
  await shot('06-panel-all-sections');

  // 7 — a few edits, then the change list
  await page.locator('h1').click();
  await page.locator('[data-testid="text"]').fill('A shorter, punchier headline');
  await page.locator('#perk-a').click();
  await page.locator('[data-testid="review-changes"]').click();
  await page.waitForTimeout(300);
  await shot('07-changes');

  // 8 — settings, everything open
  await page.locator('[data-testid="back-to-editing"]').click();
  await page.locator('[data-testid="open-settings"]').click();
  for (let pass = 0; pass < 4; pass++) {
    const shut = page.locator('.twk-settings [data-section][aria-expanded="false"]');
    const n = await shut.count();
    if (n === 0) break;
    for (let i = 0; i < n; i++) await shut.nth(0).click();
  }
  await page.waitForTimeout(300);
  await shot('08-settings-open');

  // 9 — dark
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.waitForTimeout(300);
  await shot('09-settings-dark');
  await page.locator('[data-testid="back-from-settings"]').click();
  await page.waitForTimeout(200);
  await shot('10-panel-dark');
  await page.emulateMedia({ colorScheme: 'light' });

  // 11 — minimized chip
  await page.locator('[data-testid="minimize"]').click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/11-chip.png`, clip: { x: 0, y: 620, width: 500, height: 280 } });

  // 12 — popup, 13 — options
  const id = new URL(w.url()).host;
  const p2 = await context.newPage();
  await p2.setViewportSize({ width: 420, height: 620 });
  await p2.goto(`chrome-extension://${id}/popup.html`);
  await p2.waitForTimeout(500);
  await p2.screenshot({ path: `${OUT}/12-popup.png` });
  await p2.setViewportSize({ width: 760, height: 1000 });
  await p2.goto(`chrome-extension://${id}/options.html`);
  await p2.waitForTimeout(500);
  await p2.screenshot({ path: `${OUT}/13-options.png`, fullPage: true });
});
