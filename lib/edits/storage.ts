import { browser } from 'wxt/browser';
import { parseImport } from './import';
import { SHARE_PARAM } from '../share/link';
import type { PageEdits } from './types';

/**
 * Parameters that say how you arrived, not what you are looking at.
 *
 * Deliberately short and unambiguous. Getting this list wrong in one direction costs a
 * page two sets of edits instead of one, which is visible and recoverable; wrong in the
 * other, an edit made on one piece of content appears on another. Only analytics
 * parameters are here, and anything doubtful — `ref`, `source`, `id` — is not.
 */
const ARRIVAL_ONLY = new Set([
  // Ours. A recipient arrives at the page carrying it, and presses Keep; what they keep
  // has to be filed where the page loads without it, or the edits they just adopted are
  // missing the next time they open it normally.
  SHARE_PARAM,
  'gclid', 'gbraid', 'wbraid', 'dclid', 'fbclid', 'msclkid', 'ttclid', 'twclid',
  'igshid', 'yclid', 'mc_cid', 'mc_eid', '_ga', '_gl', '_openstat', 'epik',
  's_kwcid', 'rb_clickid',
]);
const ARRIVAL_PREFIXES = ['utm_', 'pk_', 'mtm_', 'hsa_', 'oly_'];

function isArrivalOnly(name: string): boolean {
  const key = name.toLowerCase();
  return ARRIVAL_ONLY.has(key) || ARRIVAL_PREFIXES.some((prefix) => key.startsWith(prefix));
}

/**
 * Which page an edit belongs to.
 *
 * The query used to be dropped whole, and the reasoning for that was only half the
 * problem. It is true that a Shopify `?variant=`, a session id or a page number says
 * nothing about which document you are on, and that filing edits under them splits one
 * page's work in two. It is also true — and this was the half that was missed — that on
 * a great many sites the query is the only thing that names the content at all.
 * `youtube.com/watch` without its `v=` is not a video. A search result, a docs viewer,
 * a dashboard filter and every SPA that routes on a query are the same. Dropping it
 * there does not scope the work loosely, it applies one page's edits to another's
 * content, silently, and hands that on in an export.
 *
 * So the query stays, minus the parameters that only ever describe how you arrived.
 * Remaining parameters are sorted, so one page reached two ways is one page.
 *
 * A hash router's "#/products/2" is a different page; "#features" is a link within one.
 * Ignoring both meant every route of a hash-routed app shared a single bucket of edits.
 */
export function normalizePageUrl(url: string): string {
  const u = new URL(url);
  const route = u.hash.startsWith('#/') ? u.hash : '';
  const kept = [...u.searchParams.entries()]
    .filter(([name]) => !isArrivalOnly(name))
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const query = kept.length > 0 ? '?' + new URLSearchParams(kept).toString() : '';
  return u.origin + u.pathname + query + route;
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
