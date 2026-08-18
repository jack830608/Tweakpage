import { finder } from '@medv/finder';
import { isStableClass } from './stable-class';

export interface GeneratedSelector {
  selector: string;
  fallbackSelectors: string[];
  textFingerprint?: string;
  elementLabel: string;
}

export function generateSelector(el: Element): GeneratedSelector {
  // A copy Tweakpage created is identified by its stamp, nothing else: any positional
  // selector for it describes a page where the copy already exists, which a fresh load
  // is not. The stamp is minted with the copy on every replay, so it always resolves.
  const stamp = el.getAttribute('data-tweakpage-clone');
  if (stamp && /^[A-Za-z0-9_-]{1,64}$/.test(stamp)) {
    return {
      selector: `[data-tweakpage-clone="${stamp}"]`,
      fallbackSelectors: [],
      textFingerprint: el.textContent?.trim().slice(0, 60) || undefined,
      elementLabel: buildElementLabel(el),
    };
  }
  let primary: string | null = dataAttrSelector(el);
  if (!primary) {
    try {
      primary = finder(el, { className: isStableClass });
    } catch {
      primary = nthChildPath(el);
    }
  }
  const fallbacks = [nthChildPath(el)].filter((s) => s !== primary);
  const text = el.textContent?.trim().slice(0, 60) || undefined;
  return {
    selector: primary,
    fallbackSelectors: fallbacks,
    textFingerprint: text,
    elementLabel: buildElementLabel(el),
  };
}

function dataAttrSelector(el: Element): string | null {
  if (el.id) return null;
  const doc = el.ownerDocument;
  for (const { name, value } of Array.from(el.attributes)) {
    if (!name.startsWith('data-') || !/^[a-z0-9-]+$/i.test(name.slice(5))) continue;
    if (!value || value.length > 40 || /\d{3,}/.test(value)) continue;
    const selector = `[${name}="${value.replace(/(["\\])/g, '\\$1')}"]`;
    try {
      if (doc.querySelectorAll(selector).length === 1) return selector;
    } catch {
      continue;
    }
  }
  return null;
}

export function nthChildPath(el: Element): string {
  const parts: string[] = [];
  let cur: Element | null = el;
  while (cur) {
    if (cur.id) {
      parts.unshift(`#${escapeIdent(cur.id)}`);
      return parts.join(' > ');
    }
    const parent: Element | null = cur.parentElement;
    if (!parent) {
      parts.unshift(cur.tagName.toLowerCase());
      return parts.join(' > ');
    }
    const index = Array.prototype.indexOf.call(parent.children, cur) + 1;
    parts.unshift(`${cur.tagName.toLowerCase()}:nth-child(${index})`);
    cur = parent;
  }
  return parts.join(' > ');
}

export function buildElementLabel(el: Element): string {
  const tag = el.tagName.toLowerCase();
  const cls = Array.from(el.classList).find(isStableClass);
  const base = cls ? `${tag}.${cls}` : el.id ? `${tag}#${el.id}` : tag;
  const text = el.textContent?.trim().replace(/\s+/g, ' ').slice(0, 30);
  return text ? `${base} "${text}"` : base;
}

function escapeIdent(id: string): string {
  return id.replace(/([^a-zA-Z0-9_-])/g, '\\$1');
}
