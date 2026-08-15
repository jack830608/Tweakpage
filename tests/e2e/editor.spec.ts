import fs from 'node:fs';
import { expect } from '@playwright/test';
import { activateEditor, test } from './fixtures';

test('edit → persist → replay → export', async ({ context }) => {
  const page = await context.newPage();
  await page.goto('http://localhost:4173/');

  await activateEditor(context);
  await expect(page.locator('#tweakpage-host aside')).toBeVisible();

  await page.locator('h1').click();
  await page.getByLabel('Text', { exact: true }).fill('New headline');
  await expect(page.locator('h1')).toHaveText('New headline');

  await page.getByLabel('Color hex', { exact: true }).fill('#ff0000');
  await expect(page.locator('h1')).toHaveCSS('color', 'rgb(255, 0, 0)');

  await page.reload();
  await expect(page.locator('h1')).toHaveText('New headline');
  await expect(page.locator('h1')).toHaveCSS('color', 'rgb(255, 0, 0)');

  await activateEditor(context);
  await page.getByRole('button', { name: /Review/ }).click();
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

test('fields show the edited value and snap back on reset', async ({ context }) => {
  const page = await context.newPage();
  await page.goto('http://localhost:4173/');
  await activateEditor(context);
  await page.locator('h1').click();

  // Attribute selectors, not getByLabel: the reset button sits inside the same
  // <label>, so a label lookup matches two elements once an edit exists.
  const lineHeight = page.locator('input[aria-label="Line height"]');
  const originalCss = await page.locator('h1').evaluate((el) => getComputedStyle(el).lineHeight);
  const originalInput = await lineHeight.inputValue();
  await lineHeight.fill('1.5');
  await expect(page.locator('h1')).toHaveCSS('line-height', '48px');
  await expect(lineHeight).toHaveValue('1.5');
  await page.getByRole('button', { name: 'Reset lineHeight' }).click();
  await expect(page.locator('h1')).toHaveCSS('line-height', originalCss);
  await expect(lineHeight).toHaveValue(originalInput);

  // Sub-pixel values used to round to 0 on the way back into the input.
  const letterSpacing = page.locator('input[aria-label="Letter spacing"]');
  await letterSpacing.fill('0.4');
  await expect(page.locator('h1')).toHaveCSS('letter-spacing', '0.4px');
  await expect(letterSpacing).toHaveValue('0.4');
});

// The unit sweep runs against happy-dom, which has no real cascade — this is the same
// pass in a browser that actually applies our injected stylesheet.
const FIELDS = [
  { section: 'text', aria: 'Text', kind: 'fill', value: 'Swept headline', property: 'textContent' },
  { section: 'typography', aria: 'Font family', kind: 'fill', value: 'Verdana', property: 'fontFamily' },
  { section: 'typography', aria: 'Font size', kind: 'fill', value: '41', property: 'fontSize' },
  { section: 'typography', aria: 'Font weight', kind: 'select', value: '300', property: 'fontWeight' },
  { section: 'typography', aria: 'Line height', kind: 'fill', value: '1.75', property: 'lineHeight' },
  { section: 'typography', aria: 'Text align', kind: 'select', value: 'center', property: 'textAlign' },
  { section: 'typography', aria: 'Letter spacing', kind: 'fill', value: '0.3', property: 'letterSpacing' },
  { section: 'typography', aria: 'Text transform', kind: 'select', value: 'uppercase', property: 'textTransform' },
  { section: 'typography', aria: 'Color hex', kind: 'fill', value: '#ff0000', property: 'color' },
  { section: 'background', aria: 'Background color hex', kind: 'fill', value: '#00ff00', property: 'backgroundColor' },
  { section: 'appearance', aria: 'Corner radius value', kind: 'fill', value: '9', property: 'borderRadius' },
  { section: 'appearance', aria: 'Opacity value', kind: 'fill', value: '60', property: 'opacity' },
  { section: 'appearance', aria: 'Border width', kind: 'fill', value: '2', property: 'borderWidth' },
  { section: 'appearance', aria: 'Border color hex', kind: 'fill', value: '#0000ff', property: 'borderColor' },
  { section: 'size', aria: 'Width', kind: 'fill', value: '260', property: 'width' },
  { section: 'size', aria: 'Height', kind: 'fill', value: '70', property: 'height' },
  { section: 'spacing', aria: 'padding top', kind: 'fill', value: '21', property: 'paddingTop' },
  { section: 'spacing', aria: 'padding right', kind: 'fill', value: '22', property: 'paddingRight' },
  { section: 'spacing', aria: 'padding bottom', kind: 'fill', value: '23', property: 'paddingBottom' },
  { section: 'spacing', aria: 'padding left', kind: 'fill', value: '24', property: 'paddingLeft' },
  { section: 'spacing', aria: 'margin top', kind: 'fill', value: '11', property: 'marginTop' },
  { section: 'spacing', aria: 'margin right', kind: 'fill', value: '12', property: 'marginRight' },
  { section: 'spacing', aria: 'margin bottom', kind: 'fill', value: '13', property: 'marginBottom' },
  { section: 'spacing', aria: 'margin left', kind: 'fill', value: '14', property: 'marginLeft' },
] as const;

test('every field records what was typed and resets back to the original', async ({ context }) => {
  const page = await context.newPage();
  await page.goto('http://localhost:4173/');
  await activateEditor(context);
  await page.locator('h1').click();
  for (const section of ['background', 'appearance', 'size', 'spacing']) {
    await page.locator(`[data-section="${section}"]`).click();
  }

  for (const { aria, kind, value, property, section } of FIELDS) {
    const field = page.locator(`[aria-label="${aria}"]`);
    const before = await field.inputValue();

    if (kind === 'select') await field.selectOption(value);
    else await field.fill(value);

    await expect(field, `${aria} should show what was typed`).toHaveValue(value);

    const resetName = section === 'spacing' ? 'Reset spacing' : `Reset ${property}`;
    await page.getByRole('button', { name: resetName }).click();
    await expect(field, `${aria} should return to its original value`).toHaveValue(before);
  }

  await expect(page.getByRole('button', { name: 'Review changes' })).toContainText('0');
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
  await expect(page.getByRole('button', { name: 'Close' })).toBeVisible();
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
});

test('spacing box-model editor fits inside the panel', async ({ context }) => {
  const page = await context.newPage();
  await page.goto('http://localhost:4173/');
  await activateEditor(context);
  await page.locator('h1').click();
  await page.locator('[data-section="spacing"]').click();

  const inputBox = (await page.getByLabel('padding top').boundingBox())!;
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
  await page.getByLabel('Text', { exact: true }).fill('New headline');
  await expect(page.locator('h1')).toHaveText('New headline');

  await page.getByRole('button', { name: 'Original', exact: true }).click();
  await expect(page.locator('h1')).toHaveText('Original Headline');
  const badge = page.getByRole('button', { name: /Viewing original/ });
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

  await page.getByRole('button', { name: 'Browse', exact: true }).click();
  await expect(page.locator('.pgve-outline--selected')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Browsing/ })).toBeVisible();
  await page.locator('#anchor-link').click();
  expect(page.url()).toContain('#test-anchor');

  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await expect(page.locator('.pgve-outline--selected')).toBeVisible();
  await expect(page.locator('.pgve-selection-label')).toBeVisible();
  expect(page.url()).toContain('#test-anchor');
});

test('cmd+z undoes and shift+cmd+z redoes', async ({ context }) => {
  const page = await context.newPage();
  await page.goto('http://localhost:4173/');
  await activateEditor(context);
  await page.locator('h1').click();
  await page.getByLabel('Text', { exact: true }).fill('New headline');
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
  await page.getByRole('button', { name: /Review/ }).click();
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
  await page.getByLabel('Import JSON file').setInputFiles({
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
  await page.getByLabel('Text', { exact: true }).fill('New headline');
  await page.getByRole('button', { name: 'Snapshot before and after' }).click();

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
