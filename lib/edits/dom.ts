import { MARK_ATTRIBUTE } from './css';
import { textNodeAt, textNodeIndex } from './text-nodes';
import type { EditRecord } from './types';

/** Marks an element as the copy a clone record created — its identity across reapplies. */
export const CLONE_ATTRIBUTE = 'data-tweakpage-clone';

export function applyDomEdit(el: Element, record: EditRecord): void {
  if (record.type === 'text') {
    writeText(el, record, record.newValue);
  } else if (record.type === 'clone') {
    cloneAfter(el, record.id);
  } else if (record.type === 'move') {
    moveToIndex(el, Number(record.newValue));
  } else if (record.type === 'attr') {
    if (el.getAttribute(record.property) !== record.newValue) {
      el.setAttribute(record.property, record.newValue);
    }
  }
}

export function revertDomEdit(el: Element, record: EditRecord): void {
  if (record.type === 'text') {
    writeText(el, record, record.oldValue);
  } else if (record.type === 'clone') {
    el.ownerDocument.querySelector(`[${CLONE_ATTRIBUTE}="${record.id}"]`)?.remove();
  } else if (record.type === 'move') {
    moveToIndex(el, Number(record.oldValue));
  } else if (record.type === 'attr') {
    if (record.absent) {
      el.removeAttribute(record.property);
    } else if (el.getAttribute(record.property) !== record.oldValue) {
      el.setAttribute(record.property, record.oldValue);
    }
  }
}

/** What the page currently holds where this record writes — null when unreadable. */
export function readDomValue(el: Element, record: EditRecord): string | null {
  if (record.type === 'text') {
    const index = textNodeIndex(record.property);
    if (index === null) return el.textContent;
    return textNodeAt(el, index)?.nodeValue ?? null;
  }
  if (record.type === 'attr') return el.getAttribute(record.property);
  if (record.type === 'move') {
    const index = elementIndex(el);
    return index === -1 ? null : String(index);
  }
  return null;
}

// Our own nodes live in the page too; counting them would make the same index mean
// different positions with the editor open and closed.
const OUR_NODES = '#tweakpage-host, #tweakpage-marker, style[data-tweakpage-style]';

/** True for tweakpage's own UI — never pickable, never a sibling, never editable. */
export function isTweakpageNode(el: Element): boolean {
  return el.closest(OUR_NODES) !== null;
}

/** The element's position among its parent's children, ignoring tweakpage's own nodes. */
export function elementIndex(el: Element): number {
  if (!el.parentElement) return -1;
  return pageSiblings(el.parentElement).indexOf(el);
}

/** Places el at the given index among its siblings. Already there means untouched. */
export function moveToIndex(el: Element, index: number): void {
  const parent = el.parentElement;
  if (!parent || !Number.isInteger(index) || index < 0) return;
  if (elementIndex(el) === index) return;
  const others = pageSiblings(parent).filter((sibling) => sibling !== el);
  parent.insertBefore(el, others[index] ?? null);
}

/**
 * Inserts a copy of the element right after it, stamped with the record's id.
 *
 * The copy sheds every id and every tweakpage mark in its subtree: a copied id breaks
 * uniqueness for records resolving the ORIGINAL by it, and a copied mark would put one
 * record's style on two elements. Already-stamped copies make reapply a no-op — the
 * reapply loop runs on every mutation, this insertion included.
 */
function cloneAfter(el: Element, id: string): void {
  const doc = el.ownerDocument;
  if (doc.querySelector(`[${CLONE_ATTRIBUTE}="${id}"]`)) return;
  const copy = el.cloneNode(true) as Element;
  for (const node of [copy, ...Array.from(copy.querySelectorAll(`[id], [${MARK_ATTRIBUTE}], [${CLONE_ATTRIBUTE}]`))]) {
    node.removeAttribute('id');
    node.removeAttribute(MARK_ATTRIBUTE);
    node.removeAttribute(CLONE_ATTRIBUTE);
  }
  copy.setAttribute(CLONE_ATTRIBUTE, id);
  el.after(copy);
}

export function pageSiblings(parent: Element): Element[] {
  return Array.from(parent.children).filter((child) => !child.matches(OUR_NODES));
}

function writeText(el: Element, record: EditRecord, value: string): void {
  const index = textNodeIndex(record.property);
  if (index === null) {
    // Whole-element edit: only safe when the element has no markup of its own.
    if (el.textContent !== value) el.textContent = value;
    return;
  }
  const node = textNodeAt(el, index);
  if (node && node.nodeValue !== value) node.nodeValue = value;
}
