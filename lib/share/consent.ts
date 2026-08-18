import { browser } from 'wxt/browser';

/**
 * The one moment before anything leaves the machine.
 *
 * Everything else Tweakpage does happens in the browser. Uploading is the exception, and
 * it is not obvious from a button called Copy summary that a picture is about to become
 * a publicly readable object in a bucket. So the first time it would happen, we say what
 * is about to leave, where it is going, and what stays changed afterwards — and wait to
 * be told to go ahead.
 *
 * Asked once per bucket: agreeing to send images to your own bucket is not agreeing to
 * send them to a different one later.
 */
const KEY = 'tweakpage:transfer-consent';

export async function hasConsented(bucket: string): Promise<boolean> {
  try {
    const stored = (await browser.storage.local.get(KEY))[KEY] as string[] | undefined;
    return Array.isArray(stored) && stored.includes(bucket);
  } catch {
    return false;
  }
}

export async function recordConsent(bucket: string): Promise<void> {
  try {
    const stored = ((await browser.storage.local.get(KEY))[KEY] as string[] | undefined) ?? [];
    if (stored.includes(bucket)) return;
    await browser.storage.local.set({ [KEY]: [...stored, bucket] });
  } catch {
    // Not remembering costs another prompt, which is the safe direction.
  }
}

/** Settings offers this so a decision can be taken back. */
export async function withdrawConsent(): Promise<void> {
  try {
    await browser.storage.local.remove(KEY);
  } catch {
    // Nothing to do; the prompt returning is the failure mode, and it is harmless.
  }
}
