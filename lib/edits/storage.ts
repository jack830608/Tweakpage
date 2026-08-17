import { browser } from 'wxt/browser';
import type { PageEdits } from './types';

// Parameters that describe the visit, not the page: analytics tags, ad-click ids, and
// our own share reference. Everything else stays — ?view=B may serve a different
// document, and dropping it applied one account's edits to another's page.
const VISIT_PARAMS = /^(utm_|gclid$|fbclid$|msclkid$|tweakpage$)/;

export function normalizePageUrl(url: string): string {
  const u = new URL(url);
  const params = [...u.searchParams].filter(([name]) => !VISIT_PARAMS.test(name));
  // Sorted so ?a=1&b=2 and ?b=2&a=1 land in one bucket — servers don't order-match either.
  params.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const query = params.length > 0 ? `?${new URLSearchParams(params)}` : '';
  // A hash router's "#/products/2" is a different page; "#features" is a link within one.
  // Ignoring both meant every route of a hash-routed app shared a single bucket of edits.
  const route = u.hash.startsWith('#/') ? u.hash : '';
  return u.origin + u.pathname + query + route;
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
