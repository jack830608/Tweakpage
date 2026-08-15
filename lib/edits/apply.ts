import { buildCssText } from './css';
import { applyDomEdit, revertDomEdit } from './dom';
import type { EditRecord } from './types';
import { resolveRecord } from '../selector/resolve';

const STYLE_TAG_SELECTOR = 'style[data-pg-editor]';

export type ApplyStatus = 'applied' | 'not-found' | 'disabled';

export function ensureStyleTag(doc: Document): HTMLStyleElement {
  let tag = doc.querySelector<HTMLStyleElement>(STYLE_TAG_SELECTOR);
  if (!tag) {
    tag = doc.createElement('style');
    tag.setAttribute('data-pg-editor', '');
    (doc.head ?? doc.documentElement).appendChild(tag);
  }
  return tag;
}

export function applyAll(records: EditRecord[], doc: Document): Map<string, ApplyStatus> {
  const statuses = new Map<string, ApplyStatus>();
  const css = buildCssText(records);
  const hasStyleRecords = records.some((r) => r.type === 'style' && r.enabled);
  if (hasStyleRecords || css) {
    const tag = ensureStyleTag(doc);
    if (tag.textContent !== css) tag.textContent = css;
  } else {
    doc.querySelector('style[data-pg-editor]')?.remove();
  }
  for (const record of records) {
    if (!record.enabled) {
      statuses.set(record.id, 'disabled');
      continue;
    }
    const el = resolveRecord(record, doc);
    if (!el) {
      statuses.set(record.id, 'not-found');
      continue;
    }
    if (record.type !== 'style') applyDomEdit(el, record);
    statuses.set(record.id, 'applied');
  }
  return statuses;
}

export function revertAll(records: EditRecord[], doc: Document): void {
  doc.querySelector(STYLE_TAG_SELECTOR)?.remove();
  for (const record of records) {
    if (record.type === 'style') continue;
    const el = resolveRecord(record, doc);
    if (el) revertDomEdit(el, record);
  }
}
