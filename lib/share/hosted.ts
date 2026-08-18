import { browser } from 'wxt/browser';

/**
 * What we have already put in the bucket.
 *
 * An image is named after its own content, so uploading it twice writes the same bytes
 * to the same key — harmless, but it costs a request every share and, with compression
 * on, a slice of the month's TinyPNG quota for a result we already have. Remembering
 * the answer makes a second share of the same picture free.
 *
 * The remembered URL is still checked before it is trusted: buckets get emptied, and a
 * link pointing at an object that no longer exists is the failure this whole path
 * exists to avoid.
 */
const KEY = 'tweakpage:hosted-images';
/** Enough for a heavy page's worth of images across many shares, bounded so it can't grow forever. */
const MAX_REMEMBERED = 300;

type Hosted = Record<string, string>;

/** Distinguishes the same picture uploaded to different buckets, or with/without compression. */
export function hostedKey(contentHash: string, bucket: string, compressed: boolean): string {
  return `${bucket}:${compressed ? 'min' : 'raw'}:${contentHash}`;
}

export async function rememberedUrl(key: string): Promise<string | null> {
  try {
    const stored = (await browser.storage.local.get(KEY))[KEY] as Hosted | undefined;
    const url = stored?.[key];
    return typeof url === 'string' ? url : null;
  } catch {
    return null;
  }
}

export async function remember(key: string, url: string): Promise<void> {
  try {
    const stored = ((await browser.storage.local.get(KEY))[KEY] as Hosted | undefined) ?? {};
    const entries = Object.entries(stored).filter(([k]) => k !== key);
    // Oldest out first: insertion order is the only age we have, and it is enough.
    const kept = entries.slice(Math.max(0, entries.length - (MAX_REMEMBERED - 1)));
    await browser.storage.local.set({ [KEY]: { ...Object.fromEntries(kept), [key]: url } });
  } catch {
    // Forgetting only costs a re-upload.
  }
}

export async function forget(key: string): Promise<void> {
  try {
    const stored = ((await browser.storage.local.get(KEY))[KEY] as Hosted | undefined) ?? {};
    delete stored[key];
    await browser.storage.local.set({ [KEY]: stored });
  } catch {
    // Same: harmless.
  }
}
