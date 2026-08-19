import path from 'node:path';
import { chromium } from '@playwright/test';

const ext = path.resolve('.output/chrome-mv3');
const ctx = await chromium.launchPersistentContext('', {
  channel: 'chromium',
  args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`, '--lang=en-US'],
});
const w = ctx.serviceWorkers()[0] ?? (await ctx.waitForEvent('serviceworker'));
const page = await ctx.newPage();
await page.setViewportSize({ width: 1900, height: 1000 });
await page.goto('https://www.positivegrid.com/pages/product-selector', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(8000);
await w.evaluate(async () => {
  const c = globalThis.chrome;
  await c.storage.local.set({ 'tweakpage:onboarded': true });
  const [t] = await c.tabs.query({ active: true, currentWindow: true });
  await c.tabs.sendMessage(t.id, { type: 'tweakpage:toggle' });
});
await page.locator('#tweakpage-host aside').waitFor({ timeout: 15000 });

const records = () => w.evaluate(async () => {
  const all = await globalThis.chrome.storage.local.get(null);
  const k = Object.keys(all).find((x) => x.startsWith('page:') && x.includes('product-selector'));
  return (all[k]?.records ?? []).map((r) => ({ sel: r.selector, fp: r.textFingerprint, o: r.oldValue, n: r.newValue }));
});
const domOf = (sel) => page.evaluate((s) => {
  const els = [...document.querySelectorAll(s)];
  return { matches: els.length, texts: els.map((e) => e.textContent.trim()).slice(0, 5) };
}, sel);
const options = () => page.locator('#main-content button span').allTextContents();

async function editFirstOption(tag) {
  const opts = await options();
  const target = opts[0];
  await page.getByText(target, { exact: true }).first().click();
  await page.waitForTimeout(400);
  await page.locator('[data-testid="text"]').fill(`${target} JACK`);
  await page.waitForTimeout(1000);
  const recs = await records();
  const last = recs[recs.length - 1];
  console.log(`\n=== ${tag} ===`);
  console.log('  編輯目標      :', JSON.stringify(target));
  console.log('  面板欄位顯示  :', JSON.stringify(await page.locator('[data-testid="text"]').inputValue()));
  console.log('  DOM 上的文字  :', JSON.stringify((await options())[0]));
  console.log('  這筆 selector :', last?.sel, '| fp:', JSON.stringify(last?.fp));
  console.log('  該 selector 命中:', JSON.stringify(await domOf(last?.sel ?? 'x')));
  console.log('  所有記錄      :', JSON.stringify(recs, null, 0));
  return target;
}

async function advance(chosenText) {
  await page.locator('[data-testid="mode-browse"]').click();
  await page.getByText(chosenText, { exact: true }).first().click();
  await page.waitForTimeout(3000);
  await page.locator('[data-testid="mode-edit"]').click();
  await page.waitForTimeout(500);
}

const a = await editFirstOption('步驟 1');
await advance(`${a} JACK`);
const b = await editFirstOption('步驟 2');
await advance(`${b} JACK`);
await editFirstOption('步驟 3');

await page.screenshot({ path: 'test-results/journey.png' });
await ctx.close();
