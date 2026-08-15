import { browser } from 'wxt/browser';
import type { PageEdits } from './types';

export function normalizePageUrl(url: string): string {
  const u = new URL(url);
  return u.origin + u.pathname;
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
