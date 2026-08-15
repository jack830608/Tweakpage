import type { EditRecord } from '../edits/types';

type Resolvable = Pick<EditRecord, 'selector' | 'fallbackSelectors' | 'textFingerprint'>;

export function resolveRecord(record: Resolvable, root: Document | Element): Element | null {
  for (const selector of [record.selector, ...record.fallbackSelectors]) {
    const el = queryUnique(root, selector);
    if (el) return el;
  }
  if (record.textFingerprint) {
    const tag = tagForRecord(record);
    if (tag) {
      const matches = Array.from(root.querySelectorAll(tag)).filter(
        (el) => (el.textContent?.trim().slice(0, 60) ?? '') === record.textFingerprint,
      );
      if (matches.length === 1) return matches[0];
    }
  }
  return null;
}

function queryUnique(root: Document | Element, selector: string): Element | null {
  let matches: NodeListOf<Element>;
  try {
    matches = root.querySelectorAll(selector);
  } catch {
    return null;
  }
  return matches.length === 1 ? matches[0] : null;
}

function tagForRecord(record: Resolvable): string | null {
  for (const selector of [record.selector, ...record.fallbackSelectors]) {
    const tag = tagFromSelector(selector);
    if (tag) return tag;
  }
  return null;
}

function tagFromSelector(selector: string): string | null {
  const last = selector.split(/[\s>]+/).filter(Boolean).pop() ?? '';
  const m = last.match(/^[a-z][a-z0-9-]*/i);
  return m ? m[0].toLowerCase() : null;
}
