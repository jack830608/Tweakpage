import { finder } from '@medv/finder';
import { isStableClass } from './stable-class';

export interface GeneratedSelector {
  selector: string;
  fallbackSelectors: string[];
  textFingerprint?: string;
  elementLabel: string;
}

export function generateSelector(el: Element): GeneratedSelector {
  let primary: string;
  try {
    primary = finder(el, { className: isStableClass });
  } catch {
    primary = nthChildPath(el);
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
