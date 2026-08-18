import fs from 'node:fs';
import { expect } from '@playwright/test';
import { activateEditor, chromiumWithExtension, test } from './fixtures';

/** Opens a section if it is closed. Only Text is open by default. */
async function openSection(page: import('@playwright/test').Page, id: string): Promise<void> {
  const header = page.locator(`[data-section="${id}"]`);
  if ((await header.getAttribute('aria-expanded')) !== 'true') await header.click();
}

test('edit → persist → replay → export', async ({ context }) => {
  const page = await context.newPage();
  await page.goto('http://localhost:4173/');

  await activateEditor(context);
  await expect(page.locator('#tweakpage-host aside')).toBeVisible();

  await page.locator('h1').click();
  await page.locator('[data-testid="text"]').fill('New headline');
  await expect(page.locator('h1')).toHaveText('New headline');

  await openSection(page, 'typography');
  await page.locator('[data-testid="color-hex"]').fill('#ff0000');
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
  await openSection(page, 'typography');
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
interface FieldRow {
  section: string;
  testid: string;
  kind: 'fill' | 'select';
  value: string;
  /** When the field keeps its unit in the value, what it shows differs from what was typed. */
  shown?: string;
  property: string;
}

const FIELDS: FieldRow[] = [
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
  { section: 'size', testid: 'width', kind: 'fill', value: '260', shown: '260px', property: 'width' },
  { section: 'size', testid: 'height', kind: 'fill', value: '70', shown: '70px', property: 'height' },
  { section: 'spacing', testid: 'padding-top', kind: 'fill', value: '21', property: 'paddingTop' },
  { section: 'spacing', testid: 'padding-right', kind: 'fill', value: '22', property: 'paddingRight' },
  { section: 'spacing', testid: 'padding-bottom', kind: 'fill', value: '23', property: 'paddingBottom' },
  { section: 'spacing', testid: 'padding-left', kind: 'fill', value: '24', property: 'paddingLeft' },
  { section: 'spacing', testid: 'margin-top', kind: 'fill', value: '11', property: 'marginTop' },
  { section: 'spacing', testid: 'margin-right', kind: 'fill', value: '12', property: 'marginRight' },
  { section: 'spacing', testid: 'margin-bottom', kind: 'fill', value: '13', property: 'marginBottom' },
  { section: 'spacing', testid: 'margin-left', kind: 'fill', value: '14', property: 'marginLeft' },
];

test('every field records what was typed and resets back to the original', async ({ context }) => {
  const page = await context.newPage();
  await page.goto('http://localhost:4173/');
  await activateEditor(context);
  await page.locator('h1').click();
  for (const section of new Set(FIELDS.map((f) => f.section))) {
    await openSection(page, section);
  }

  for (const { testid, kind, value, shown, property, section } of FIELDS) {
    const field = page.locator(`[data-testid="${testid}"]`);
    const before = await field.inputValue();

    if (kind === 'select') await field.selectOption(value);
    else await field.fill(value);

    // Fields that take several units keep the unit in the value, so what is shown can
    // differ from what was typed — the row says which.
    await expect(field, `${testid} should show what was typed`).toHaveValue(shown ?? value);

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
  await page.locator('.twk-change button[data-testid^="select-change-"]').first().click();

  // Smooth scrolling settles over a few frames.
  await expect.poll(() => page.evaluate(() => window.scrollY), { timeout: 5000 }).toBeLessThan(300);
  await expect(page.locator('.twk-outline--selected')).toBeVisible();
});

test('swapping a responsive image actually changes what the browser shows', async ({ context }) => {
  const page = await context.newPage();
  await page.goto('http://localhost:4173/');
  await activateEditor(context);
  // Selecting an image opens its section already; clicking it here would close it.
  await page.locator('#responsive').click();

  const green =
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='40'%3E%3Crect width='60' height='40' fill='%2300ff00'/%3E%3C/svg%3E";
  const before = await page.locator('#responsive').evaluate((img: HTMLImageElement) => img.currentSrc);
  expect(before).toContain('ff0000');

  await page.locator('[data-testid="image-url"]').fill(green);
  await page.locator('[data-testid="image-url"]').press('Enter');

  // src alone is invisible while srcset holds candidates — this is the whole point.
  await expect
    .poll(() => page.locator('#responsive').evaluate((img: HTMLImageElement) => img.currentSrc))
    .toContain('00ff00');

  await page.reload();
  await expect
    .poll(() => page.locator('#responsive').evaluate((img: HTMLImageElement) => img.currentSrc))
    .toContain('00ff00');
});

test('every control in the panel is labelled, addressable and in a field row', async ({
  context,
}) => {
  const page = await context.newPage();
  await page.goto('http://localhost:4173/');
  await activateEditor(context);
  await page.locator('h1').click();
  for (const section of ['text', 'typography', 'background', 'appearance', 'size', 'layout', 'spacing']) {
    await openSection(page, section);
  }

  const audit = await page.evaluate(() => {
    const root = document.getElementById('tweakpage-host')!.shadowRoot!;
    const problems: string[] = [];
    const controls = Array.from(root.querySelectorAll('input, select, textarea'));
    for (const el of controls) {
      const id = el.getAttribute('data-testid') ?? el.getAttribute('aria-label') ?? el.outerHTML.slice(0, 50);
      if (!el.getAttribute('data-testid')) problems.push(`${id}: no data-testid`);
      if (!el.getAttribute('aria-label')) problems.push(`${id}: no aria-label`);
      // A property editor belongs in a Field row — that is what gives it a name and a reset.
      if (el.closest('.twk-section') && !el.closest('.twk-field') && !el.closest('.twk-box')) {
        problems.push(`${id}: in a section but not in a field row`);
      }
    }
    return { count: controls.length, problems };
  });

  expect(audit.count, 'the sweep should reach every control').toBeGreaterThan(20);
  expect(audit.problems).toEqual([]);
});

test('no field wears a native decoration over its unit', async ({ context }) => {
  const page = await context.newPage();
  await page.goto('http://localhost:4173/');
  await activateEditor(context);
  await page.locator('h1').click();
  for (const section of ['size', 'appearance']) {
    await openSection(page, section);
  }

  // Chrome's spinner and datalist arrow are drawn in the same corner as the unit chip, and
  // their computed style lies inside a shadow root — so measure the pixels instead.
  const darkPixelsAtRightEdge = async (testid: string) => {
    const field = page.locator(`[data-testid="${testid}"]`);
    // The panel scrolls internally, so a field can sit outside the captured area.
    await field.scrollIntoViewIfNeeded();
    const box = (await field.boundingBox())!;
    await page.mouse.move(box.x + box.width - 8, box.y + box.height / 2);
    await page.waitForTimeout(250);
    const shot = await page.screenshot({
      clip: { x: box.x + box.width - 22, y: box.y + 2, width: 18, height: box.height - 4 },
    });
    // PNG pixels via canvas in the page, so the test needs no image library.
    return page.evaluate(async (bytes) => {
      const blob = new Blob([new Uint8Array(bytes)], { type: 'image/png' });
      const bitmap = await createImageBitmap(blob);
      const canvas = document.createElement('canvas');
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(bitmap, 0, 0);
      const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
      let dark = 0;
      for (let i = 0; i < data.length; i += 4) {
        if ((data[i] + data[i + 1] + data[i + 2]) / 3 < 120) dark++;
      }
      return dark;
    }, Array.from(shot));
  };

  // width carries a datalist, border-width is a number input: the two decorations Chrome adds.
  expect(await darkPixelsAtRightEdge('width'), 'a datalist arrow is sitting on the unit').toBeLessThan(20);
  expect(await darkPixelsAtRightEdge('border-width'), 'a spinner is sitting on the unit').toBeLessThan(20);
});

test('two proposals can be saved and switched between', async ({ context }) => {
  const page = await context.newPage();
  await page.goto('http://localhost:4173/');
  await activateEditor(context);
  await page.locator('h1').click();

  await page.locator('[data-testid="text"]').fill('Option A headline');
  await page.locator('[data-testid="new-variant"]').click();
  await page.locator('[data-testid="variant-name"]').fill('A');
  await page.locator('[data-testid="save-variant"]').click();

  await page.locator('[data-testid="text"]').fill('Option B headline');
  await expect(page.locator('h1')).toHaveText('Option B headline');

  // Switching back is what makes the two comparable without rebuilding either.
  await page.locator('.twk-variant button', { hasText: 'A' }).first().click();
  await expect(page.locator('h1')).toHaveText('Option A headline');

  // And it survives a reload, because a proposal is stored with the page.
  await page.reload();
  await expect(page.locator('h1')).toHaveText('Option A headline');
  await activateEditor(context);
  await expect(page.locator('.twk-variant')).toHaveCount(1);
});

test('the share button is dead until a bucket is configured', async ({ context }) => {
  const page = await context.newPage();
  await page.goto('http://localhost:4173/');
  await activateEditor(context);

  const button = page.locator('[data-testid="share-link"]');
  await expect(button, 'a button that can only fail should not invite a click').toBeDisabled();

  // The attribute alone proved nothing a person could see: this button was disabled and
  // looked exactly like its neighbours — same opacity, same colour, same pointer cursor.
  const [share, neighbour] = await Promise.all([
    button.evaluate((el) => {
      const cs = getComputedStyle(el);
      return { opacity: Number(cs.opacity), cursor: cs.cursor };
    }),
    page.locator('[data-testid="copy-summary"]').evaluate((el) => Number(getComputedStyle(el).opacity)),
  ]);
  expect(share.opacity, 'it should read as unavailable').toBeLessThan(neighbour);
  expect(share.cursor).not.toBe('pointer');

  // The tooltip is translated, so assert that it says something rather than what.
  const explained = await button.getAttribute('title');
  expect(explained?.length ?? 0, 'a disabled button must say why').toBeGreaterThan(10);
});

test('the popup can reach the settings the share button needs', async ({ context }) => {
  const page = await context.newPage();
  const [worker] = context.serviceWorkers().length
    ? context.serviceWorkers()
    : [await context.waitForEvent('serviceworker')];
  const extensionId = new URL(worker.url()).host;

  await page.goto(`chrome-extension://${extensionId}/popup.html`);
  // Right-clicking the toolbar icon is where nobody looks for this.
  await expect(page.locator('[data-testid="open-settings"]')).toBeVisible();

  await page.goto(`chrome-extension://${extensionId}/options.html`);
  for (const field of ['bucket', 'region', 'accessKeyId', 'secretAccessKey']) {
    await expect(page.locator(`[data-testid="${field}"]`)).toBeVisible();
  }
});

test('a shared link works for someone who has set nothing up', async ({ context }) => {
  // Stand in for S3: the PUT keeps the body, the GET hands it back.
  const stored = new Map<string, string>();
  await context.route('https://**.amazonaws.com/**', async (route) => {
    const request = route.request();
    if (request.method() === 'PUT') {
      stored.set(new URL(request.url()).pathname, request.postData() ?? '');
      // Real uploads take real time; the busy state below needs a window to exist in.
      await new Promise((resolve) => setTimeout(resolve, 400));
      return route.fulfill({ status: 200, body: '' });
    }
    const body = stored.get(new URL(request.url()).pathname);
    return body === undefined
      ? route.fulfill({ status: 404, body: '' })
      : route.fulfill({ status: 200, contentType: 'application/json', body });
  });

  const sender = await context.newPage();
  await sender.goto('http://localhost:4173/');

  // The worker only exists once something has woken it, so open the page first.
  let [worker] = context.serviceWorkers();
  if (!worker) worker = await context.waitForEvent('serviceworker');
  await worker.evaluate(async () => {
    await (globalThis as any).chrome.storage.local.set({
      'tweakpage:share-settings': {
        bucket: 'demo-bucket',
        region: 'ap-northeast-1',
        accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
        secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
      },
    });
  });
  await activateEditor(context);
  await sender.locator('h1').click();
  await sender.locator('[data-testid="text"]').fill('Headline from a colleague');
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const shareButton = sender.locator('[data-testid="share-link"]');
  await shareButton.click();
  // The upload takes real time; a silent button reads as broken and gets re-clicked.
  await expect(shareButton).toHaveAttribute('aria-busy', 'true');
  await expect(shareButton).toBeDisabled();
  const toast = sender.locator('[data-testid="toast"]');
  await expect(toast).toBeVisible();
  await expect(toast, 'the outcome is legible as a success, not just words').toHaveAttribute(
    'data-kind',
    'success',
  );
  await expect(toast.locator('.twk-toast-icon')).toBeVisible();
  await expect(shareButton).toHaveAttribute('aria-busy', 'false');

  const link: string = await sender.evaluate(() => navigator.clipboard.readText());
  expect(link, 'the link points at the page, carrying a reference').toContain('?tweakpage=');

  // A second profile: no bucket, no keys, nothing configured.
  const reader = await chromiumWithExtension();
  await reader.context.route('https://**.amazonaws.com/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: stored.get(new URL(route.request().url()).pathname) ?? '',
    }),
  );
  const readerPage = await reader.context.newPage();
  await readerPage.goto(link);

  await expect(readerPage.locator('h1'), 'the edits arrive without any setup').toHaveText(
    'Headline from a colleague',
  );
  // While the panel is open, the banner speaks and the corner marker stays out of it.
  await expect(readerPage.locator('#tweakpage-marker')).toHaveCount(0);
  // The reader's own copy of the page must be untouched: following a link is looking.
  const plain = await reader.context.newPage();
  await plain.goto('http://localhost:4173/');
  await expect(plain.locator('h1'), 'a link must not edit the page you already had').toHaveText(
    'Original Headline',
  );
  await expect(plain.locator('#tweakpage-marker')).toHaveCount(0);
  await plain.close();

  await expect(
    readerPage.locator('[data-testid="shared-preview"]'),
    'and says the edits came from someone else',
  ).toBeVisible();

  // Closing the panel mid-preview hands the story to the marker: the page still shows
  // someone else's edits and still has to say so.
  await readerPage.locator('[data-testid="close"]').click();
  await expect(readerPage.locator('#tweakpage-marker button')).toBeVisible();

  // And the marker is the way back in.
  await readerPage.locator('#tweakpage-marker button').click();
  await expect(readerPage.locator('[data-testid="shared-preview"]')).toBeVisible();
  await expect(readerPage.locator('#tweakpage-marker'), 'the panel is back — the marker yields').toHaveCount(0);

  // Keeping is the decision that makes them yours, and only then do they persist.
  await readerPage.locator('[data-testid="keep-shared"]').click();
  await expect(readerPage.locator('[data-testid="shared-preview"]')).toHaveCount(0);
  const kept = await reader.context.newPage();
  await kept.goto('http://localhost:4173/');
  await expect(kept.locator('h1')).toHaveText('Headline from a colleague');
  await reader.context.close();
});

test('an edited page says so, even with the editor closed', async ({ context }) => {
  const page = await context.newPage();
  await page.goto('http://localhost:4173/');
  await activateEditor(context);
  await page.locator('h1').click();
  await page.locator('[data-testid="text"]').fill('Edited headline');
  await page.locator('[data-testid="close"]').click();
  await expect(page.locator('#tweakpage-host aside')).toHaveCount(0);

  const marker = page.locator('#tweakpage-marker button');
  await expect(marker, 'the page is not what the site serves — say so').toBeVisible();
  await expect(marker).toContainText('1');

  // The point of the marker is the visit where nobody opens the editor at all.
  await page.reload();
  await expect(page.locator('h1')).toHaveText('Edited headline');
  await expect(page.locator('#tweakpage-host aside')).toHaveCount(0);
  await expect(page.locator('#tweakpage-marker button')).toBeVisible();

  // And clicking it is how you get to the editor from there.
  await page.locator('#tweakpage-marker button').click();
  await expect(page.locator('#tweakpage-host aside')).toBeVisible();
});

test('header and change count stay reachable when the panel scrolls', async ({ context }) => {
  const page = await context.newPage();
  await page.goto('http://localhost:4173/');
  await activateEditor(context);
  await page.locator('h1').click();
  for (const section of new Set(FIELDS.map((f) => f.section))) {
    await openSection(page, section);
  }

  const panel = page.locator('#tweakpage-host aside');
  await panel.evaluate((el) => el.scrollTo(0, el.scrollHeight));
  const panelBox = (await panel.boundingBox())!;
  const headerBox = (await page.locator('.twk-header').boundingBox())!;
  const footerBox = (await page.locator('.twk-footer').boundingBox())!;

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

  const outline = page.locator('.twk-outline--selected');
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
    const box = host.shadowRoot!.querySelector('.twk-outline--selected')!;
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
  expect(await opacityOf('.twk-panel'), 'the page should show through at rest').toBeLessThan(1);
  // The outline is a sibling, not a child: fading the panel must not dim what it points at.
  expect(await opacityOf('.twk-outline--selected')).toBe(1);

  await page.mouse.move(box.x + box.width / 2, box.y + 120);
  await page.waitForTimeout(300);
  expect(await opacityOf('.twk-panel'), 'reaching for the panel should make it solid').toBe(1);
});

test('choosing a theme beats the system setting in both directions', async ({ context }) => {
  const page = await context.newPage();
  await page.goto('http://localhost:4173/');
  await activateEditor(context);
  const background = () =>
    page.evaluate(
      () =>
        getComputedStyle(
          document.getElementById('tweakpage-host')!.shadowRoot!.querySelector('.twk-panel')!,
        ).backgroundColor,
    );

  // Theme lives in the panel's own settings now, not behind the toolbar icon.
  await page.locator('[data-testid="open-settings"]').click();

  // The failing half was light-on-a-dark-system: the tokens lived on two different
  // elements, so a chosen light theme quietly inherited the dark ones.
  for (const scheme of ['dark', 'light'] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await page.locator('[data-testid="mode-light"]').click();
    await page.waitForTimeout(200);
    expect(await background(), `light chosen on a ${scheme} system`).toBe('rgb(255, 255, 255)');

    await page.locator('[data-testid="mode-dark"]').click();
    await page.waitForTimeout(200);
    expect(await background(), `dark chosen on a ${scheme} system`).toBe('rgb(33, 33, 38)');

    await page.locator('[data-testid="mode-system"]').click();
    await page.waitForTimeout(200);
    expect(await background(), `following a ${scheme} system`).toBe(
      scheme === 'dark' ? 'rgb(33, 33, 38)' : 'rgb(255, 255, 255)',
    );
  }
});

test('the header controls stay inside the panel', async ({ context }) => {
  const page = await context.newPage();
  await page.goto('http://localhost:4173/');
  await activateEditor(context);
  await page.locator('h1').click();

  const panel = (await page.locator('#tweakpage-host aside').boundingBox())!;
  for (const testid of ['close', 'minimize', 'open-settings', 'undo', 'redo']) {
    const box = (await page.locator(`[data-testid="${testid}"]`).boundingBox())!;
    expect(box.x, `${testid} starts inside the panel`).toBeGreaterThanOrEqual(panel.x);
    expect(box.x + box.width, `${testid} ends inside the panel`).toBeLessThanOrEqual(
      panel.x + panel.width,
    );
  }
});

test('spacing box-model editor fits inside the panel', async ({ context }) => {
  const page = await context.newPage();
  await page.goto('http://localhost:4173/');
  await activateEditor(context);
  await page.locator('h1').click();
  await openSection(page, 'spacing');

  const inputBox = (await page.locator('[data-testid="padding-top"]').boundingBox())!;
  expect(inputBox.width).toBeLessThan(60);

  const panelBox = (await page.locator('#tweakpage-host aside').boundingBox())!;
  const marginBox = (await page.locator('.twk-box--margin').boundingBox())!;
  const paddingBox = (await page.locator('.twk-box--padding').boundingBox())!;
  expect(paddingBox.x + paddingBox.width).toBeLessThanOrEqual(marginBox.x + marginBox.width + 1);
  expect(marginBox.x + marginBox.width).toBeLessThanOrEqual(panelBox.x + panelBox.width + 1);
});

test('panel can be dragged to a new position and stays in the viewport', async ({ context }) => {
  const page = await context.newPage();
  await page.goto('http://localhost:4173/');
  await activateEditor(context);

  const panel = page.locator('#tweakpage-host aside');
  const before = (await panel.boundingBox())!;
  const header = (await page.locator('.twk-header').boundingBox())!;

  // Grab the title, not the middle — the header carries undo, redo and the theme picker.
  const grabX = header.x + 60;
  const grabY = header.y + header.height / 2;
  await page.mouse.move(grabX, grabY);
  await page.mouse.down();
  await page.mouse.move(grabX - 400, grabY + 150, { steps: 5 });
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
  await expect(page.locator('.twk-outline--selected')).toBeVisible();

  await page.locator('[data-testid="mode-browse"]').click();
  await expect(page.locator('.twk-outline--selected')).toHaveCount(0);
  await expect(page.locator('[data-testid="browsing-switch-to-edit"]')).toBeVisible();
  await page.locator('#anchor-link').click();
  expect(page.url()).toContain('#test-anchor');

  await page.locator('[data-testid="mode-edit"]').click();
  await expect(page.locator('.twk-outline--selected')).toBeVisible();
  await expect(page.locator('.twk-selection-label')).toBeVisible();
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

test('snapshot saves one image with the two states side by side', async ({ context }) => {
  const page = await context.newPage();
  await page.goto('http://localhost:4173/');
  await activateEditor(context);
  await page.locator('h1').click();
  await page.locator('[data-testid="text"]').fill('New headline');
  await page.locator('[data-testid="snapshot-before-and-after"]').click();

  // Playwright reroutes downloads into its artifacts dir under random names, so assert
  // on content rather than filename.
  const [worker] = context.serviceWorkers();
  const files: string[] = await worker.evaluate(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const c = (globalThis as any).chrome;
    const deadline = Date.now() + 15_000;
    while (Date.now() < deadline) {
      const items = await c.downloads.search({});
      const done = items.filter((i: { state: string }) => i.state === 'complete');
      if (done.length >= 1) return done.map((i: { filename: string }) => i.filename);
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    throw new Error('the capture did not complete');
  });

  expect(files, 'the two states arrive as one image, not two files').toHaveLength(1);
  const png = fs.readFileSync(files[0]);
  expect(png.subarray(1, 4).toString()).toBe('PNG');

  // PNG header: width and height are big-endian 32-bit values at byte 16.
  const width = png.readUInt32BE(16);
  const height = png.readUInt32BE(20);
  const viewport = page.viewportSize()!;
  expect(width, 'both captures sit next to each other').toBeGreaterThan(viewport.width * 1.5);
  expect(height).toBeGreaterThan(viewport.height);
});

test('settings live in the panel, and filling them in switches sharing on', async ({ context }) => {
  const page = await context.newPage();
  await page.goto('http://localhost:4173/');
  await activateEditor(context);
  await page.locator('h1').click();

  const share = page.locator('[data-testid="share-link"]');
  const before = await share.evaluate((el) => getComputedStyle(el).opacity);

  await page.locator('[data-testid="open-settings"]').click();
  await expect(page.locator('.twk-settings')).toBeVisible();

  // Nothing may push past the panel: the settings labels are long identifiers, and a
  // row that overflows is invisible until someone opens it on a real page.
  const panel = (await page.locator('#tweakpage-host aside').boundingBox())!;
  for (const row of await page.locator('.twk-setting').all()) {
    const box = (await row.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(panel.x);
    expect(box.x + box.width).toBeLessThanOrEqual(panel.x + panel.width + 1);
  }

  for (const [key, value] of [
    ['bucket', 'demo-bucket'],
    ['region', 'ap-northeast-1'],
    ['accessKeyId', 'AKIAIOSFODNN7EXAMPLE'],
    ['secretAccessKey', 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY'],
  ]) {
    await page.locator(`[data-testid="setting-${key}"]`).fill(value);
  }

  await page.locator('[data-testid="back-from-settings"]').click();
  await expect
    .poll(() => share.evaluate((el) => getComputedStyle(el).opacity))
    .not.toBe(before);
  expect(Number(await share.evaluate((el) => getComputedStyle(el).opacity))).toBe(1);
});

test('clearing from the popup puts the open page back, with no reload', async ({ context }) => {
  const page = await context.newPage();
  await page.goto('http://localhost:4173/');
  await activateEditor(context);
  await page.locator('h1').click();
  await page.locator('[data-testid="text"]').fill('Edited headline');
  await page.locator('[data-testid="close"]').click();
  await expect(page.locator('#tweakpage-marker button')).toBeVisible();

  // The real popup, in a tab of its own — the page under edit stays open beside it.
  let [worker] = context.serviceWorkers();
  if (!worker) worker = await context.waitForEvent('serviceworker');
  const popup = await context.newPage();
  // chrome-extension:// has no origin as far as URL() is concerned, so slice the id out.
  const extensionRoot = worker.url().slice(0, worker.url().lastIndexOf('/'));
  await popup.goto(`${extensionRoot}/popup.html`);
  const clear = popup.locator('[data-testid="clear-page"]').first();
  await clear.click();
  await clear.click();

  // No reload here: this is the tab that was already open when the edits were dropped.
  await expect(page.locator('h1'), 'the page should come back on its own').toHaveText(
    'Original Headline',
  );
  await expect(page.locator('#tweakpage-marker')).toHaveCount(0);
});

test('the panel can be resized without a pointer', async ({ context }) => {
  const page = await context.newPage();
  await page.goto('http://localhost:4173/');
  await activateEditor(context);

  const handle = page.locator('[data-testid="resize-panel"]');
  await handle.focus();
  const focused = await page.evaluate(
    () =>
      document.getElementById('tweakpage-host')!.shadowRoot!.activeElement?.getAttribute('data-testid'),
  );
  expect(focused, 'the handle takes keyboard focus').toBe('resize-panel');

  // Focus on a 6px strip must be visible, not just present.
  const idleBg = await page.evaluate(() => {
    const host = document.getElementById('tweakpage-host')!.shadowRoot!;
    return getComputedStyle(host.querySelector('[data-testid="resize-panel"]')!).backgroundColor;
  });
  expect(idleBg, 'focused handle is painted').not.toBe('rgba(0, 0, 0, 0)');

  const width = () => page.locator('#tweakpage-host aside').evaluate((el) => el.getBoundingClientRect().width);
  const before = await width();
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowLeft');
  expect(await width(), 'ArrowLeft widens the right-anchored panel').toBe(before + 32);

  await page.keyboard.press('ArrowRight');
  expect(await width()).toBe(before + 16);

  await page.keyboard.press('End');
  expect(await width(), 'End snaps to the minimum').toBe(280);

  const now = await handle.getAttribute('aria-valuenow');
  expect(Number(now), 'the separator announces its value').toBe(280);
});

test('the idle panel stays readable, measured, in both themes', async ({ context }) => {
  const page = await context.newPage();
  await page.goto('http://localhost:4173/');
  await activateEditor(context);
  await page.locator('h1').click();
  // Park the pointer on the page so the panel is genuinely idle.
  await page.mouse.move(10, 10);
  await page.waitForTimeout(300);

  // Idle translucency is a feature; text falling to 2.9:1 was the bug (review finding 4).
  // Measured the way a screen shows it: text and panel blended toward the page by the
  // panel's own opacity, then WCAG contrast between the two results.
  const contrastOf = () =>
    page.evaluate(() => {
      const host = document.getElementById('tweakpage-host')!.shadowRoot!;
      const panel = host.querySelector('.twk-panel') as HTMLElement;
      const sample = host.querySelector('.twk-prop') as HTMLElement; // ink-2 secondary text
      const o = Number(getComputedStyle(panel).opacity);
      const rgb = (s: string) => s.match(/\d+(\.\d+)?/g)!.slice(0, 3).map(Number);
      const behind = [255, 255, 255]; // the fixture page is white
      const blend = (c: number[]) => c.map((v, i) => o * v + (1 - o) * behind[i]);
      const lum = (c: number[]) => {
        const [r, g, b] = c.map((v) => {
          const s = v / 255;
          return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
        });
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
      };
      const text = lum(blend(rgb(getComputedStyle(sample).color)));
      const bg = lum(blend(rgb(getComputedStyle(panel).backgroundColor)));
      return (Math.max(text, bg) + 0.05) / (Math.min(text, bg) + 0.05);
    });

  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await page.waitForTimeout(200);
    expect(await contrastOf(), `secondary text on an idle ${scheme} panel`).toBeGreaterThanOrEqual(4.5);
  }
});

test('reordering siblings persists, undoes, and leaves other edits on the right elements', async ({
  context,
}) => {
  const page = await context.newPage();
  await page.goto('http://localhost:4173/');
  await activateEditor(context);
  const order = () =>
    page.evaluate(() => [...document.querySelectorAll('#perks li')].map((li) => li.id).join(','));

  // Pin an edit on the third perk before anything moves — it has to stay on that
  // element, not on whatever ends up third.
  await page.locator('#perk-c').click();
  await page.locator('[data-testid="text"]').fill('Three-year warranty');

  await page.locator('#perk-b').click();
  await page.locator('[data-testid="move-up"]').click();
  await expect.poll(order).toBe('perk-b,perk-a,perk-c');

  // The reapply loop runs on every mutation, ours included; give it time to misbehave.
  await page.waitForTimeout(200);
  expect(await order(), 'the reapply loop must not fight the move').toBe('perk-b,perk-a,perk-c');
  await expect(page.locator('#perk-c')).toHaveText('Three-year warranty');

  // Undo puts the order back; redo re-arranges it. (The undo stack lives in the
  // session, so this happens before the reload.)
  await page.locator('[data-testid="undo"]').click();
  await expect.poll(order).toBe('perk-a,perk-b,perk-c');
  await page.locator('[data-testid="redo"]').click();
  await expect.poll(order).toBe('perk-b,perk-a,perk-c');

  // Replay from storage on a fresh load — the applier, no editor.
  await page.reload();
  await expect.poll(order).toBe('perk-b,perk-a,perk-c');
  await expect(page.locator('#perk-c'), 'the text edit still belongs to perk-c').toHaveText(
    'Three-year warranty',
  );

  // At the edges there is nowhere further to go.
  await activateEditor(context);
  await page.locator('#perk-b').click();
  const up = page.locator('[data-testid="move-up"]');
  await expect(up).toBeDisabled();
  const [disabledOpacity, enabledOpacity] = await Promise.all([
    up.evaluate((el) => getComputedStyle(el).opacity),
    page.locator('[data-testid="move-down"]').evaluate((el) => getComputedStyle(el).opacity),
  ]);
  expect(Number(disabledOpacity), 'a dead arrow has to look dead').toBeLessThan(Number(enabledOpacity));
});

test('one chip, one home: it hides with the panel and holds its spot otherwise', async ({
  context,
}) => {
  const page = await context.newPage();
  await page.goto('http://localhost:4173/');
  await activateEditor(context);
  await page.locator('h1').click();
  await page.locator('[data-testid="text"]').fill('Edited headline');

  // Panel open: its footer carries the count, no chip anywhere.
  await expect(page.locator('#tweakpage-marker')).toHaveCount(0);

  // Minimized: the chip appears bottom-left and is the way back in.
  await page.locator('[data-testid="minimize"]').click();
  const chip = page.locator('#tweakpage-marker button');
  await expect(chip).toBeVisible();
  const minimizedBox = (await chip.boundingBox())!;
  const viewport = page.viewportSize()!;
  expect(minimizedBox.x, 'the chip lives on the left').toBeLessThan(viewport.width / 2);
  expect(minimizedBox.y, 'and at the bottom').toBeGreaterThan(viewport.height / 2);

  // Clicking it brings the panel back — up, never toggled shut.
  await chip.click();
  await expect(page.locator('#tweakpage-host aside')).toBeVisible();
  await expect(page.locator('#tweakpage-marker')).toHaveCount(0);

  // Closed: the chip returns in exactly the same place — one home, not two corners.
  await page.locator('[data-testid="close"]').click();
  await expect(chip).toBeVisible();
  const closedBox = (await chip.boundingBox())!;
  expect(closedBox.x).toBe(minimizedBox.x);
  expect(closedBox.y).toBe(minimizedBox.y);
});

test('moving an element keeps it on screen', async ({ context }) => {
  const page = await context.newPage();
  await page.goto('http://localhost:4173/');
  // Tall rows: one step down moves the element a full viewport-height away.
  await page.addStyleTag({ content: '#perks li { height: 70vh; }' });
  await activateEditor(context);

  await page.locator('#perk-a').click();
  const down = page.locator('[data-testid="move-down"]');
  await down.click();
  await down.click();

  // Two steps put perk-a ~140vh from the top; without following it, the user is left
  // staring at the hole it used to fill.
  await expect
    .poll(
      () =>
        page.locator('#perk-a').evaluate((el) => {
          const rect = el.getBoundingClientRect();
          return rect.top >= -10 && rect.top < window.innerHeight;
        }),
      { timeout: 3000 },
    )
    .toBe(true);
});

test('double-click edits text in place, and the applier does not eat the typing', async ({
  context,
}) => {
  const page = await context.newPage();
  await page.goto('http://localhost:4173/');
  await activateEditor(context);

  // An existing edit first, so the reapply loop has something it wants to write.
  await page.locator('h1').click();
  await page.locator('[data-testid="text"]').fill('Edited headline');
  await page.waitForTimeout(150);

  await page.locator('h1').dblclick();
  await expect(page.locator('h1')).toHaveAttribute('contenteditable', 'plaintext-only');
  await page.keyboard.press('End');
  // Slowly, so the 50ms reapply window opens between keystrokes.
  await page.keyboard.type(' typed', { delay: 60 });
  await expect(page.locator('h1'), 'every keystroke survives').toHaveText('Edited headline typed');

  // Clicking away commits.
  await page.locator('.lead').click();
  await expect(page.locator('h1')).not.toHaveAttribute('contenteditable', /./);

  // It went through the same records as the panel: replay proves it.
  await page.reload();
  await expect(page.locator('h1')).toHaveText('Edited headline typed');

  // And the panel shows the committed text, coalesced into the one record.
  await activateEditor(context);
  await page.locator('h1').click();
  await expect(page.locator('[data-testid="text"]')).toHaveValue('Edited headline typed');
});

test('inline editing keeps inline markup and records only the changed run', async ({ context }) => {
  const page = await context.newPage();
  await page.goto('http://localhost:4173/');
  await activateEditor(context);

  await page.locator('#promo span').dblclick(); // dblclick selects the word "shipping"
  await page.keyboard.type('delivery');
  await page.keyboard.press('Escape'); // Esc blurs, which commits
  await expect(page.locator('#promo span'), 'the span survives with its style').toHaveText(
    'delivery',
  );
  await expect(page.locator('#promo')).toHaveText('Fast delivery included');

  await page.reload();
  await expect(page.locator('#promo span')).toHaveText('delivery');
  const color = await page.locator('#promo span').evaluate((el) => getComputedStyle(el).color);
  expect(color, 'markup and styling intact after replay').toBe('rgb(0, 128, 0)');
});

test('the panel follows inline typing live, before any blur', async ({ context }) => {
  const page = await context.newPage();
  await page.goto('http://localhost:4173/');
  await activateEditor(context);
  await page.locator('h1').click(); // panel shows the text section for the h1

  await page.locator('h1').dblclick();
  await page.keyboard.press('End');
  await page.keyboard.type(' live');
  // No blur, no click-away: the element is still being edited.
  await expect(page.locator('h1')).toHaveAttribute('contenteditable', 'plaintext-only');
  await expect(
    page.locator('[data-testid="text"]'),
    'the panel text box mirrors the typing as it happens',
  ).toHaveValue('Original Headline live');
  await expect(page.locator('[data-testid="review-changes"]')).toContainText('1');
});

test('duplicate an element, edit the copy, and it all survives a reload', async ({ context }) => {
  const page = await context.newPage();
  await page.goto('http://localhost:4173/');
  await activateEditor(context);
  const texts = () =>
    page.evaluate(() => [...document.querySelectorAll('#perks li')].map((li) => li.textContent));

  await page.locator('#perk-b').click();
  await page.locator('[data-testid="duplicate-element"]').click();
  await expect.poll(texts).toEqual(['Fast shipping', 'Free returns', 'Free returns', 'Two-year warranty']);

  // The copy is selected on creation — edit it directly.
  await page.locator('[data-testid="text"]').fill('Free exchanges');
  await expect.poll(texts).toEqual(['Fast shipping', 'Free returns', 'Free exchanges', 'Two-year warranty']);

  // Fresh load: the applier recreates the copy, and the copy's own edit lands on it —
  // the second apply pass the insertion itself triggers.
  await page.reload();
  await expect.poll(texts).toEqual(['Fast shipping', 'Free returns', 'Free exchanges', 'Two-year warranty']);

  // The original was never touched.
  await expect(page.locator('#perk-b')).toHaveText('Free returns');
});

test('custom CSS applies, replays, and toggles like any other edit', async ({ context }) => {
  const page = await context.newPage();
  await page.goto('http://localhost:4173/');
  await activateEditor(context);
  await page.locator('h1').click();

  const advanced = page.locator('[data-section="advanced"]');
  if ((await advanced.getAttribute('aria-expanded')) !== 'true') await advanced.click();
  await page.locator('[data-testid="custom-css"]').fill('letter-spacing: 4px; text-decoration: underline;');
  await page.locator('[data-testid="custom-css"]').blur();

  const decoration = () =>
    page.locator('h1').evaluate((el) => getComputedStyle(el).textDecorationLine);
  await expect.poll(decoration, { timeout: 3000 }).toBe('underline');

  // Replays like anything else.
  await page.reload();
  await expect.poll(decoration, { timeout: 3000 }).toBe('underline');

  // And each declaration is its own change in Review, individually revocable.
  await activateEditor(context);
  await page.locator('[data-testid="review-changes"]').click();
  const toggles = page.locator('.twk-change-switch');
  await expect(toggles).toHaveCount(2);
});
