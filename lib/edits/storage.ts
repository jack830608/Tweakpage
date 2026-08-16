import { browser } from 'wxt/browser';
import type { PageEdits } from './types';

export function normalizePageUrl(url: string): string {
  const u = new URL(url);
  // A hash router's "#/products/2" is a different page; "#features" is a link within one.
  // Ignoring both meant every route of a hash-routed app shared a single bucket of edits.
  const route = u.hash.startsWith('#/') ? u.hash : '';
  return u.origin + u.pathname + route;
}

export function pageKey(url: string): string {
  return `page:${normalizePageUrl(url)}`;
}

export async function loadPageEdits(url: string): Promise<PageEdits | null> {
  const key = pageKey(url);
  const result = await browser.storage.local.get(key);
  return (result[key] as PageEdits | undefined) ?? null;
}

export async function savePageEdits(page: PageEdits): Promise<void> {
  const key = pageKey(page.url);
  if (page.records.length === 0) {
    await browser.storage.local.remove(key);
  } else {
    await browser.storage.local.set({ [key]: page });
  }
}
