/**
 * Draws the extension icon at every size the manifest asks for, plus the store's promo
 * tile, from one drawing.
 *
 * Three lines of a page, and the one you changed is out of line with the rest — shorter
 * margin on the left, past the others on the right, and in the ink the panel uses for a
 * selected element's label. That is the whole product: a page, and the specific thing
 * that is now different.
 *
 * Everything here was decided at 16 pixels first, where the icon actually lives. Shapes
 * that only work large were tried and thrown out: a browser window with a cursor (the
 * category's house style, and its dashed marquee dissolves), a chip on a block's corner
 * (a folder), a block with its corner detached (a sticky note), two lines instead of
 * three (the lower one loses contrast against the tile).
 *
 * The 128 is inset to 96×96 — the artwork size the Web Store lays its grid out against.
 * The toolbar sizes are drawn at their natural size and take no padding.
 *
 * Run: pnpm icons
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const EMERALD_LIGHT = '#10b981';
const EMERALD_DEEP = '#047857';
const INK = '#18181b';

const MARK = `
  <rect x="0" y="0" width="128" height="128" rx="29" fill="url(#tile)"/>
  <rect x="26" y="29" width="72" height="13" rx="6.5" fill="#ffffff"/>
  <rect x="42" y="55" width="68" height="16" rx="8" fill="${INK}"/>
  <rect x="26" y="84" width="48" height="13" rx="6.5" fill="#ffffff"/>`;

function svg(inset = 0) {
  const scale = (128 - inset * 2) / 128;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
  <defs>
    <linearGradient id="tile" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="128" y2="128">
      <stop offset="0" stop-color="${EMERALD_LIGHT}"/>
      <stop offset="1" stop-color="${EMERALD_DEEP}"/>
    </linearGradient>
  </defs>
  <g transform="translate(${inset} ${inset}) scale(${scale})">${MARK}</g>
</svg>`;
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 512, height: 512 } });
await mkdir('public/icon', { recursive: true });
await mkdir('docs/assets/store', { recursive: true });

for (const [size, inset] of [
  [16, 0],
  [32, 0],
  [48, 0],
  [128, 16],
]) {
  await page.setContent(
    `<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${svg(inset)}`,
  );
  await writeFile(
    `public/icon/${size}.png`,
    await page.locator('svg').screenshot({ omitBackground: true }),
  );
  console.log(`public/icon/${size}.png`);
}

// The same drawing, unrasterised, so this script is not the only way to change it.
await writeFile('docs/assets/icon.svg', svg());

// The store's small promo tile. It is read at a glance in a grid, so it carries the
// mark, the name, and one line saying what the thing does — nothing that needs reading.
const tile = await browser.newPage({ viewport: { width: 440, height: 280 } });
await tile.setContent(`<style>
  html,body{margin:0}
  body{width:440px;height:280px;display:flex;align-items:center;gap:28px;padding:0 44px;
       box-sizing:border-box;background:#ffffff;
       font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;
       position:relative;overflow:hidden}
  .wash{position:absolute;right:-90px;top:-110px;width:300px;height:300px;border-radius:50%;
        background:radial-gradient(circle,${EMERALD_LIGHT} 0%,transparent 70%);opacity:.16}
  svg{width:88px;height:88px;flex:none;position:relative}
  .text{position:relative}
  h1{margin:0;font-size:38px;line-height:1.1;font-weight:700;letter-spacing:-.02em;color:${INK}}
  p{margin:8px 0 0;font-size:16px;line-height:1.45;font-weight:500;color:#52525b}
</style>
<div class="wash"></div>${svg()}
<div class="text"><h1>Tweakpage</h1><p>Change the page.<br>Send the list.</p></div>`);
await tile.screenshot({ path: 'docs/assets/store/promo-440x280.png' });
console.log('docs/assets/store/promo-440x280.png');

await browser.close();
