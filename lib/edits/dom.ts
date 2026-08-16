import { textNodeAt, textNodeIndex } from './text-nodes';
import type { EditRecord } from './types';

export function applyDomEdit(el: Element, record: EditRecord): void {
  if (record.type === 'text') {
    writeText(el, record, record.newValue);
  } else if (record.type === 'attr') {
    if (el.getAttribute(record.property) !== record.newValue) {
      el.setAttribute(record.property, record.newValue);
    }
  }
}

export function revertDomEdit(el: Element, record: EditRecord): void {
  if (record.type === 'text') {
    writeText(el, record, record.oldValue);
  } else if (record.type === 'attr') {
    if (el.getAttribute(record.property) !== record.oldValue) {
      el.setAttribute(record.property, record.oldValue);
    }
  }
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
