import type { EditRecord } from './types';

export function cssPropertyName(property: string): string {
  return property.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
}

export function buildCssText(records: EditRecord[]): string {
  return records
    .filter((r) => r.type === 'style' && r.enabled)
    .map((r) => `${r.selector} { ${cssPropertyName(r.property)}: ${r.newValue} !important; }`)
    .join('\n');
}
