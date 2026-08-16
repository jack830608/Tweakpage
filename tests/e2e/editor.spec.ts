import fs from 'node:fs';
import { expect } from '@playwright/test';
import { activateEditor, test } from './fixtures';

test('edit → persist → replay → export', async ({ context }) => {
  const page = await context.newPage();
  await page.goto('http://localhost:4173/');

  await activateEditor(context);
  await expect(page.locator('#tweakpage-host aside')).toBeVisible();

  await page.locator('h1').click();
  await page.locator('[data-testid="text"]').fill('New headline');
  await expect(page.locator('h1')).toHaveText('New headline');

  await page.locator('input[aria-label$="hex"]').first().fill('#ff0000');
  await expect(page.locator('h1')).toHaveCSS('color', 'rgb(255, 0, 0)');

  await page.reload();
  await expect(page.locator('h1')).toHaveText('New headline');
  await expect(page.locator('h1')).toHaveCSS('color', 'rgb(255, 0, 0)');

  await activateEditor(context);
  await page.locator('[data-testid="review-changes"]').click();
  await page.locator('[data-testid="export-json"]').click();

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

test('fields show the edited value and snap back on reset', async ({ context }) => {
  const page = await context.newPage();
  await page.goto('http://localhost:4173/');
  await activateEditor(context);
  await page.locator('h1').click();

  // Attribute selectors, not getByLabel: the reset button sits inside the same
  // <label>, so a label lookup matches two elements once an edit exists.
  const lineHeight = page.locator('[data-testid="line-height"]');
  const originalCss = await page.locator('h1').evaluate((el) => getComputedStyle(el).lineHeight);
  const originalInput = await lineHeight.inputValue();
  await lineHeight.fill('1.5');
  await expect(page.locator('h1')).toHaveCSS('line-height', '48px');
  await expect(lineHeight).toHaveValue('1.5');
  await page.locator('[data-testid="reset-lineHeight"]').click();
  await expect(page.locator('h1')).toHaveCSS('line-height', originalCss);
  await expect(lineHeight).toHaveValue(originalInput);

  // Sub-pixel values used to round to 0 on the way back into the input.
  const letterSpacing = page.locator('[data-testid="letter-spacing"]');
  await letterSpacing.fill('0.4');
  await expect(page.locator('h1')).toHaveCSS('letter-spacing', '0.4px');
  await expect(letterSpacing).toHaveValue('0.4');
});

// The unit sweep runs against happy-dom, which has no real cascade — this is the same
// pass in a browser that actually applies our injected stylesheet.
const FIELDS = [
  { section: 'text', testid: 'text', kind: 'fill', value: 'Swept headline', property: 'textContent' },
  { section: 'typography', testid: 'font-family', kind: 'fill', value: 'Verdana', property: 'fontFamily' },
  { section: 'typography', testid: 'font-size', kind: 'fill', value: '41', property: 'fontSize' },
  { section: 'typography', testid: 'font-weight', kind: 'select', value: '300', property: 'fontWeight' },
  { section: 'typography', testid: 'line-height', kind: 'fill', value: '1.75', property: 'lineHeight' },
  { section: 'typography', testid: 'text-align', kind: 'select', value: 'center', property: 'textAlign' },
  { section: 'typography', testid: 'letter-spacing', kind: 'fill', value: '0.3', property: 'letterSpacing' },
  { section: 'typography', testid: 'text-transform', kind: 'select', value: 'uppercase', property: 'textTransform' },
  { section: 'typography', testid: 'color-hex', kind: 'fill', value: '#ff0000', property: 'color' },
  { section: 'background', testid: 'backgroundColor-hex', kind: 'fill', value: '#00ff00', property: 'backgroundColor' },
  { section: 'appearance', testid: 'corner-radius-value', kind: 'fill', value: '9', property: 'borderRadius' },
  { section: 'appearance', testid: 'opacity-value', kind: 'fill', value: '60', property: 'opacity' },
  { section: 'appearance', testid: 'border-width', kind: 'fill', value: '2', property: 'borderWidth' },
  { section: 'appearance', testid: 'borderColor-hex', kind: 'fill', value: '#0000ff', property: 'borderColor' },
  { section: 'size', testid: 'width', kind: 'fill', value: '260', property: 'width' },
  { section: 'size', testid: 'height', kind: 'fill', value: '70', property: 'height' },
  { section: 'spacing', testid: 'padding-top', kind: 'fill', value: '21', property: 'paddingTop' },
  { section: 'spacing', testid: 'padding-right', kind: 'fill', value: '22', property: 'paddingRight' },
  { section: 'spacing', testid: 'padding-bottom', kind: 'fill', value: '23', property: 'paddingBottom' },
  { section: 'spacing', testid: 'padding-left', kind: 'fill', value: '24', property: 'paddingLeft' },
  { section: 'spacing', testid: 'margin-top', kind: 'fill', value: '11', property: 'marginTop' },
  { section: 'spacing', testid: 'margin-right', kind: 'fill', value: '12', property: 'marginRight' },
  { section: 'spacing', testid: 'margin-bottom', kind: 'fill', value: '13', property: 'marginBottom' },
  { section: 'spacing', testid: 'margin-left', kind: 'fill', value: '14', property: 'marginLeft' },
] as const;

test('every field records what was typed and resets back to the original', async ({ context }) => {
  const page = await context.newPage();
  await page.goto('http://localhost:4173/');
  await activateEditor(context);
  await page.locator('h1').click();
  for (const section of ['background', 'appearance', 'size', 'spacing']) {
    await page.locator(`[data-section="${section}"]`).click();
  }

  for (const { testid, kind, value, property, section } of FIELDS) {
    const field = page.locator(`[data-testid="${testid}"]`);
    const before = await field.inputValue();

    if (kind === 'select') await field.selectOption(value);
    else await field.fill(value);

    await expect(field, `${testid} should show what was typed`).toHaveValue(value);

    const reset = section === 'spacing' ? 'reset-spacing' : `reset-${property}`;
    await page.locator(`[data-testid="${reset}"]`).click();
    await expect(field, `${testid} should return to its original value`).toHaveValue(before);
  }

  await expect(page.locator('[data-testid="review-changes"]')).toContainText('0');
});

test('clicking a change scrolls the page back to its element', async ({ context }) => {
  const page = await context.newPage();
  await page.goto('http://localhost:4173/');
  await activateEditor(context);
  await page.locator('h1').click();
  await page.locator('[data-testid="text"]').fill('Scrolled headline');

  await page.evaluate(() => window.scrollTo(0, 1800));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(1000);

  await page.locator('[data-testid="review-changes"]').click();
  await page.locator('.pgve-change').first().click();

  // Smooth scrolling settles over a few frames.
  await expect.poll(() => page.evaluate(() => window.scrollY), { timeout: 5000 }).toBeLessThan(300);
  await expect(page.locator('.pgve-outline--selected')).toBeVisible();
});

test('header and change count stay reachable when the panel scrolls', async ({ context }) => {
  const page = await context.newPage();
  await page.goto('http://localhost:4173/');
  await activateEditor(context);
  await page.locator('h1').click();
  for (const section of ['background', 'appearance', 'size', 'spacing']) {
    await page.locator(`[data-section="${section}"]`).click();
  }

  const panel = page.locator('#tweakpage-host aside');
  await panel.evaluate((el) => el.scrollTo(0, el.scrollHeight));
  const panelBox = (await panel.boundingBox())!;
  const headerBox = (await page.locator('.pgve-header').boundingBox())!;
  const footerBox = (await page.locator('.pgve-footer').boundingBox())!;

  expect(headerBox.y).toBeGreaterThanOrEqual(panelBox.y - 1);
  expect(headerBox.y).toBeLessThan(panelBox.y + headerBox.height + 1);
  expect(footerBox.y + footerBox.height).toBeLessThanOrEqual(panelBox.y + panelBox.height + 1);
  await expect(page.locator('[data-testid="close"]')).toBeVisible();
});

test('selection outline stays legible against the page', async ({ context }) => {
  const page = await context.newPage();
  await page.goto('http://localhost:4173/');
  await activateEditor(context);
  await page.locator('h1').click();

  const outline = page.locator('.pgve-outline--selected');
  await expect(outline).toHaveCSS('outline-width', '3px');
  // The white halo is what keeps the stroke readable on dark and busy backgrounds.
  const shadow = await outline.evaluate((el) => getComputedStyle(el).boxShadow);
  expect(shadow).not.toBe('none');
  expect(shadow).toContain('rgba(255, 255, 255');

  // The stroke has to come from the token. Hard-coded copies are how the outline, the
  // badge and the pill drifted apart from the accent in the first place.
  const colors = await page.evaluate(() => {
    const host = document.getElementById('tweakpage-host')!;
    const probe = document.createElement('div');
    probe.style.color = getComputedStyle(host).getPropertyValue('--outline').trim();
    document.body.append(probe);
    const token = getComputedStyle(probe).color;
    probe.remove();
    const box = host.shadowRoot!.querySelector('.pgve-outline--selected')!;
    return { token, painted: getComputedStyle(box).outlineColor };
  });
  expect(colors.token).not.toBe('');
  expect(colors.painted).toBe(colors.token);
});

test('the panel fades at rest and comes back solid once you reach for it', async ({ context }) => {
  const page = await context.newPage();
  await page.goto('http://localhost:4173/');
  await activateEditor(context);
  await page.locator('h1').click();
  const panel = page.locator('#tweakpage-host aside');
  const box = (await panel.boundingBox())!;
  const opacityOf = (selector: string) =>
    page.evaluate((sel) => {
      const el = document.getElementById('tweakpage-host')!.shadowRoot!.querySelector(sel)!;
      return Number(getComputedStyle(el).opacity);
    }, selector);

  await page.mouse.move(200, 500);
  await page.waitForTimeout(300);
  expect(await opacityOf('.pgve-panel'), 'the page should show through at rest').toBeLessThan(1);
  // The outline is a sibling, not a child: fading the panel must not dim what it points at.
  expect(await opacityOf('.pgve-outline--selected')).toBe(1);

  await page.mouse.move(box.x + box.width / 2, box.y + 120);
  await page.waitForTimeout(300);
  expect(await opacityOf('.pgve-panel'), 'reaching for the panel should make it solid').toBe(1);
});

test('the minimized pill follows the colour scheme', async ({ context }) => {
  const page = await context.newPage();
  await page.goto('http://localhost:4173/');
  await activateEditor(context);
  await page.locator('[data-testid="minimize"]').click();
  const pill = page.locator('.pgve-pill');
  await expect(pill).toBeVisible();

  // The pill used to sit outside the token scope and stayed light in dark mode.
  const surfaceOf = () =>
    page.evaluate(() => {
      const host = document.getElementById('tweakpage-host')!;
      const probe = document.createElement('div');
      probe.style.color = getComputedStyle(host).getPropertyValue('--surface').trim();
      document.body.append(probe);
      const token = getComputedStyle(probe).color;
      probe.remove();
      const el = host.shadowRoot!.querySelector('.pgve-pill')!;
      return { token, painted: getComputedStyle(el).backgroundColor };
    });

  await page.emulateMedia({ colorScheme: 'light' });
  const light = await surfaceOf();
  expect(light.painted).toBe(light.token);

  await page.emulateMedia({ colorScheme: 'dark' });
  const dark = await surfaceOf();
  expect(dark.painted).toBe(dark.token);
  expect(dark.painted).not.toBe(light.painted);
});

test('spacing box-model editor fits inside the panel', async ({ context }) => {
  const page = await context.newPage();
  await page.goto('http://localhost:4173/');
  await activateEditor(context);
  await page.locator('h1').click();
  await page.locator('[data-section="spacing"]').click();

  const inputBox = (await page.locator('[data-testid="padding-top"]').boundingBox())!;
  expect(inputBox.width).toBeLessThan(60);

  const panelBox = (await page.locator('#tweakpage-host aside').boundingBox())!;
  const marginBox = (await page.locator('.pgve-box--margin').boundingBox())!;
  const paddingBox = (await page.locator('.pgve-box--padding').boundingBox())!;
  expect(paddingBox.x + paddingBox.width).toBeLessThanOrEqual(marginBox.x + marginBox.width + 1);
  expect(marginBox.x + marginBox.width).toBeLessThanOrEqual(panelBox.x + panelBox.width + 1);
});

test('panel can be dragged to a new position and stays in the viewport', async ({ context }) => {
  const page = await context.newPage();
  await page.goto('http://localhost:4173/');
  await activateEditor(context);

  const panel = page.locator('#tweakpage-host aside');
  const before = (await panel.boundingBox())!;
  const header = (await page.locator('.pgve-header').boundingBox())!;

  await page.mouse.move(header.x + header.width / 2, header.y + header.height / 2);
  await page.mouse.down();
  await page.mouse.move(header.x + header.width / 2 - 400, header.y + header.height / 2 + 150, { steps: 5 });
  await page.mouse.up();

  const after = (await panel.boundingBox())!;
  expect(after.x).toBeLessThan(before.x - 300);
  expect(after.y).toBeGreaterThan(before.y + 100);
  expect(after.x).toBeGreaterThanOrEqual(0);
  expect(after.y).toBeGreaterThanOrEqual(0);
});

test('compare switch previews the original and the badge exits preview', async ({ context }) => {
  const page = await context.newPage();
  await page.goto('http://localhost:4173/');
  await activateEditor(context);
  await page.locator('h1').click();
  await page.locator('[data-testid="text"]').fill('New headline');
  await expect(page.locator('h1')).toHaveText('New headline');

  await page.locator('[data-testid="mode-original"]').click();
  await expect(page.locator('h1')).toHaveText('Original Headline');
  const badge = page.locator('[data-testid="viewing-original-back-to-edited"]');
  await expect(badge).toBeVisible();
  await page.waitForTimeout(200);
  await expect(page.locator('h1')).toHaveText('Original Headline');

  await badge.click();
  await expect(page.locator('h1')).toHaveText('New headline');
});

test('browse mode passes clicks through; edit mode selects', async ({ context }) => {
  const page = await context.newPage();
  await page.goto('http://localhost:4173/');
  await activateEditor(context);

  await page.locator('h1').click();
  await expect(page.locator('.pgve-outline--selected')).toBeVisible();

  await page.locator('[data-testid="mode-browse"]').click();
  await expect(page.locator('.pgve-outline--selected')).toHaveCount(0);
  await expect(page.locator('[data-testid="browsing-switch-to-edit"]')).toBeVisible();
  await page.locator('#anchor-link').click();
  expect(page.url()).toContain('#test-anchor');

  await page.locator('[data-testid="mode-edit"]').click();
  await expect(page.locator('.pgve-outline--selected')).toBeVisible();
  await expect(page.locator('.pgve-selection-label')).toBeVisible();
  expect(page.url()).toContain('#test-anchor');
});

test('cmd+z undoes and shift+cmd+z redoes', async ({ context }) => {
  const page = await context.newPage();
  await page.goto('http://localhost:4173/');
  await activateEditor(context);
  await page.locator('h1').click();
  await page.locator('[data-testid="text"]').fill('New headline');
  await expect(page.locator('h1')).toHaveText('New headline');

  await page.locator('p.lead').click();
  await page.keyboard.press('Meta+z');
  await expect(page.locator('h1')).toHaveText('Original Headline');
  await page.keyboard.press('Shift+Meta+z');
  await expect(page.locator('h1')).toHaveText('New headline');
});

test('importing a json file applies edits to the matching page', async ({ context }) => {
  const page = await context.newPage();
  await page.goto('http://localhost:4173/');
  await activateEditor(context);
  await page.locator('[data-testid="review-changes"]').click();
  const json = JSON.stringify({
    version: 1,
    url: 'http://localhost:4173/',
    title: 'T',
    updatedAt: 'now',
    records: [{
      id: 'r1', selector: 'h1', fallbackSelectors: [], elementLabel: 'h1',
      type: 'text', property: 'textContent',
      oldValue: 'Original Headline', newValue: 'Imported headline',
      enabled: true, createdAt: 'n', updatedAt: 'n',
    }],
  });
  await page.locator('[data-testid="import-json-file"]').setInputFiles({
    name: 'edits.json',
    mimeType: 'application/json',
    buffer: Buffer.from(json),
  });
  await expect(page.locator('h1')).toHaveText('Imported headline');
});

test('snapshot downloads before and after captures', async ({ context }) => {
  const page = await context.newPage();
  await page.goto('http://localhost:4173/');
  await activateEditor(context);
  await page.locator('h1').click();
  await page.locator('[data-testid="text"]').fill('New headline');
  await page.locator('[data-testid="snapshot-before-and-after"]').click();

  // Playwright reroutes downloads into its artifacts dir under random names, so assert
  // on content: two completed downloads, both PNG, with different pixels (before ≠ after).
  const [worker] = context.serviceWorkers();
  const files: string[] = await worker.evaluate(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const c = (globalThis as any).chrome;
    const deadline = Date.now() + 15_000;
    while (Date.now() < deadline) {
      const items = await c.downloads.search({});
      const done = items.filter((i: { state: string }) => i.state === 'complete');
      if (done.length >= 2) return done.map((i: { filename: string }) => i.filename);
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    throw new Error('captures did not complete');
  });
  expect(files).toHaveLength(2);
  const first = fs.readFileSync(files[0]);
  const second = fs.readFileSync(files[1]);
  expect(first.subarray(1, 4).toString()).toBe('PNG');
  expect(second.subarray(1, 4).toString()).toBe('PNG');
  expect(first.equals(second)).toBe(false);
});
