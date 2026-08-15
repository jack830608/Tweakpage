import type { EditRecord } from './types';

export function applyDomEdit(el: Element, record: EditRecord): void {
  if (record.type === 'text') {
    if (el.textContent !== record.newValue) el.textContent = record.newValue;
  } else if (record.type === 'attr') {
    if (el.getAttribute(record.property) !== record.newValue) {
      el.setAttribute(record.property, record.newValue);
    }
  }
}

export function revertDomEdit(el: Element, record: EditRecord): void {
  if (record.type === 'text') {
    if (el.textContent !== record.oldValue) el.textContent = record.oldValue;
  } else if (record.type === 'attr') {
    if (el.getAttribute(record.property) !== record.oldValue) {
      el.setAttribute(record.property, record.oldValue);
    }
  }
}
