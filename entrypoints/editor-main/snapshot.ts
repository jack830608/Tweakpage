import { browser } from 'wxt/browser';
import type { EditsController } from './controller';

const CAPTURE_GAP_MS = 600;

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
  try {
    controller.setPreviewOriginal(false);
    await settle();
    await browser.runtime.sendMessage({
      type: 'pg:capture',
      filename: `tweakpage-${hostname}-edited-${stamp}.png`,
    });
    await wait(gapMs);
    controller.setPreviewOriginal(true);
    await settle();
    await browser.runtime.sendMessage({
      type: 'pg:capture',
      filename: `tweakpage-${hostname}-original-${stamp}.png`,
    });
  } finally {
    controller.setPreviewOriginal(wasPreviewing);
    host.style.display = '';
  }
}

function settle(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
