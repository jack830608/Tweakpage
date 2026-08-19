import { browser } from 'wxt/browser';
import { parseImport } from './import';
import type { PageEdits } from './types';

/**
 * Which page an edit belongs to.
 *
 * The query string is left out, and that is a deliberate reversal. For a while it was
 * part of the identity, on the reasoning that ?view=A and ?view=B can serve different
 * documents — true, and rare. What is common is a query that says nothing about which
 * page you are on: a Shopify ?variant=, a session id, a page number, a campaign tag the
 * strip-list had not heard of. Including it meant clicking a variant lost the work you
 * had just done, silently, and edits made before the rule changed became unreachable.
 *
 * Both rules are wrong sometimes, so the choice is between their failures. Ignoring the
 * query can apply an edit on a variant of the page you did not edit — visible, and one
 * click to switch off. Including it loses your work without saying so. The second is
 * worse, so the query stays out.
 *
 * A hash router's "#/products/2" is a different page; "#features" is a link within one.
 * Ignoring both meant every route of a hash-routed app shared a single bucket of edits.
 */
export function normalizePageUrl(url: string): string {
  const u = new URL(url);
  const route = u.hash.startsWith('#/') ? u.hash : '';
  return u.origin + u.pathname + route;
}

export function pageKey(url: string): string {
  return `page:${normalizePageUrl(url)}`;
}

/**
 * What is in storage is not necessarily what we put there.
 *
 * The cast used to be taken on faith, so a value that had been truncated, hand-edited in
 * devtools, or written by a version that shaped things differently threw on first use —
 * and the throw was swallowed by the applier's `.catch(() => {})`. The result was a page
 * whose every saved edit stopped replaying, permanently, with no message anywhere; the
 * popup showed the same page as "no saved edits yet", which is data loss displayed as an
 * empty state.
 *
 * The import path already knows how to be handed something arbitrary. This is the same
 * boundary, so it uses the same gate, and what it cannot make sense of it says so about.
 */
export async function loadPageEdits(url: string): Promise<PageEdits | null> {
  const key = pageKey(url);
  const result = await browser.storage.local.get(key);
  const stored = result[key];
  if (stored === undefined) return null;
  const parsed = parseImport(JSON.stringify(stored));
  if (parsed.ok) return { ...parsed.page, url: normalizePageUrl(url) };
  console.warn('[tweakpage] stored edits for this page could not be read:', parsed.error);
  return null;
}

export async function savePageEdits(page: PageEdits): Promise<void> {
  const key = pageKey(page.url);
  if (page.records.length === 0) {
    await browser.storage.local.remove(key);
  } else {
    await browser.storage.local.set({ [key]: page });
  }
}
