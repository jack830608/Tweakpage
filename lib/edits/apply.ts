import { buildCssText, isSafeRecordId, MARK_ATTRIBUTE } from './css';
import { applyDomEdit, revertDomEdit } from './dom';
import type { EditRecord } from './types';
import { resolveRecord } from '../selector/resolve';

const STYLE_TAG_SELECTOR = 'style[data-pg-editor]';
const MARKED_SELECTOR = `[${MARK_ATTRIBUTE}]`;

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
  const marks = new Map<Element, string[]>();
  const applied: EditRecord[] = [];

  for (const record of records) {
    if (!record.enabled) {
      statuses.set(record.id, 'disabled');
      continue;
    }
    if (record.type === 'style' && !isSafeRecordId(record.id)) {
      statuses.set(record.id, 'not-found');
      continue;
    }
    // A 'similar' edit is aimed at a family on purpose, so every match gets the mark.
    const targets =
      record.scope === 'similar' && record.type === 'style'
        ? matchAll(doc, record.selector)
        : [resolveRecord(record, doc)].filter((el): el is Element => el !== null);
    if (targets.length === 0) {
      statuses.set(record.id, 'not-found');
      continue;
    }
    for (const el of targets) {
      if (record.type === 'style') {
        marks.set(el, [...(marks.get(el) ?? []), record.id]);
      } else {
        applyDomEdit(el, record);
      }
    }
    applied.push(record);
    statuses.set(record.id, 'applied');
  }

  syncMarks(doc, marks);

  // Only edits that resolved get a rule, so "applied" in the list and "styled" on the
  // page can no longer drift apart.
  const css = buildCssText(applied);
  if (css) {
    const tag = ensureStyleTag(doc);
    if (tag.textContent !== css) tag.textContent = css;
  } else {
    doc.querySelector(STYLE_TAG_SELECTOR)?.remove();
  }
  return statuses;
}

function matchAll(doc: Document, selector: string): Element[] {
  try {
    return Array.from(doc.querySelectorAll(selector));
  } catch {
    return [];
  }
}

/** Writes only what changed: an unchanged setAttribute still notifies observers. */
function syncMarks(doc: Document, marks: Map<Element, string[]>): void {
  for (const el of Array.from(doc.querySelectorAll(MARKED_SELECTOR))) {
    if (!marks.has(el)) el.removeAttribute(MARK_ATTRIBUTE);
  }
  for (const [el, ids] of marks) {
    const value = ids.join(' ');
    if (el.getAttribute(MARK_ATTRIBUTE) !== value) el.setAttribute(MARK_ATTRIBUTE, value);
  }
}

export function revertAll(records: EditRecord[], doc: Document): void {
  doc.querySelector(STYLE_TAG_SELECTOR)?.remove();
  for (const el of Array.from(doc.querySelectorAll(MARKED_SELECTOR))) {
    el.removeAttribute(MARK_ATTRIBUTE);
  }
  for (const record of records) {
    if (record.type === 'style') continue;
    const el = resolveRecord(record, doc);
    if (el) revertDomEdit(el, record);
  }
}
