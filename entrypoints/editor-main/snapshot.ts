import { browser } from 'wxt/browser';
import type { EditsController } from './controller';

const CAPTURE_GAP_MS = 600;
const LABEL_HEIGHT = 34;
const GUTTER = 12;

/**
 * Saves one image with the original and the edited page beside each other.
 *
 * Two separate PNGs landing in the downloads folder left the comparison as an exercise
 * for whoever received them — and the pair was only recognisable by filename.
 */
export async function captureBeforeAfter(
  controller: EditsController,
  host: HTMLElement,
  doc: Document,
  { gapMs = CAPTURE_GAP_MS }: { gapMs?: number } = {},
): Promise<void> {
  const stamp = new Date().toISOString().slice(0, 10).replaceAll('-', '');
  const hostname = new URL(doc.location.href).hostname;
  const wasPreviewing = controller.isPreviewingOriginal();
  host.style.display = 'none';
  let edited: string | undefined;
  let original: string | undefined;
  try {
    controller.setPreviewOriginal(false);
    await settle();
    edited = await grab();
    await wait(gapMs);
    controller.setPreviewOriginal(true);
    await settle();
    original = await grab();
  } finally {
    controller.setPreviewOriginal(wasPreviewing);
    host.style.display = '';
  }
  if (!edited || !original) throw new Error('capture failed');

  const composite = await sideBySide(original, edited);
  await browser.runtime.sendMessage({
    type: 'pg:save-png',
    filename: `tweakpage-${hostname}-before-after-${stamp}.png`,
    url: composite,
  });
}

async function grab(): Promise<string | undefined> {
  const result = await browser.runtime.sendMessage({ type: 'pg:grab' });
  return typeof result === 'string' ? result : undefined;
}

async function sideBySide(originalUrl: string, editedUrl: string): Promise<string> {
  const [before, after] = await Promise.all([loadImage(originalUrl), loadImage(editedUrl)]);
  const width = before.width + after.width + GUTTER;
  const height = Math.max(before.height, after.height) + LABEL_HEIGHT;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no canvas context');

  ctx.fillStyle = '#18181b';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(before, 0, LABEL_HEIGHT);
  ctx.drawImage(after, before.width + GUTTER, LABEL_HEIGHT);

  ctx.fillStyle = '#f4f4f5';
  ctx.font = '600 15px -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif';
  ctx.textBaseline = 'middle';
  ctx.fillText('Original', 10, LABEL_HEIGHT / 2);
  ctx.fillText('Edited', before.width + GUTTER + 10, LABEL_HEIGHT / 2);
  return canvas.toDataURL('image/png');
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image failed to load'));
    img.src = src;
  });
}

function settle(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
