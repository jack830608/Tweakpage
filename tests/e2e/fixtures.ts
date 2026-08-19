import path from 'node:path';
import { chromium, test as base, type BrowserContext } from '@playwright/test';

/** A second, independently configured browser — used to play the person receiving a link. */
export async function chromiumWithExtension(): Promise<{ context: BrowserContext }> {
  const extensionPath = path.resolve('.output/chrome-mv3');
  const context = await chromium.launchPersistentContext('', {
    channel: 'chromium',
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      '--lang=en-US',
    ],
  });
  return { context };
}

export const test = base.extend<{ context: BrowserContext }>({
  context: async ({}, use) => {
    const extensionPath = path.resolve('.output/chrome-mv3');
    const context = await chromium.launchPersistentContext('', {
      channel: 'chromium',
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
        '--lang=en-US',
      ],
    });
    await use(context);
    await context.close();
  },
});

/**
 * `fresh: true` leaves the onboarding flag alone.
 *
 * Every other test sets it, which meant the first screen a new user ever sees was
 * rendered by nothing in the suite at all — it could have thrown and the suite would
 * still have been green.
 */
export async function activateEditor(
  context: BrowserContext,
  { fresh = false }: { fresh?: boolean } = {},
): Promise<void> {
  let [worker] = context.serviceWorkers();
  if (!worker) worker = await context.waitForEvent('serviceworker');
  await worker.evaluate(async (isFresh: boolean) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const c = (globalThis as any).chrome;
    if (isFresh) await c.storage.local.remove('tweakpage:onboarded');
    else await c.storage.local.set({ 'tweakpage:onboarded': true });
    const [tab] = await c.tabs.query({ active: true, currentWindow: true });
    await c.tabs.sendMessage(tab.id, { type: 'tweakpage:toggle' });
  }, fresh);
}
