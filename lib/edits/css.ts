import type { EditRecord } from './types';

/** Marks the one element a record resolved to. See applyAll. */
export const MARK_ATTRIBUTE = 'data-tweakpage';

/** Ids come from makeId, but an imported file could carry anything. */
const SAFE_ID = /^[A-Za-z0-9_-]{1,64}$/;

export function cssPropertyName(property: string): string {
  return property.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
}

export function isSafeRecordId(id: string): boolean {
  return SAFE_ID.test(id);
}

/**
 * Rules target the mark on a single element, never the stored selector.
 *
 * Emitting the selector meant a rule written for one button restyled every button the
 * moment the site changed enough for that selector to match more than one — while the
 * review list, which resolves through a unique-match query, reported the edit as not
 * applied. The page and the UI disagreed, and the page was wrong.
 */
export function buildCssText(records: EditRecord[]): string {
  return records
    .filter((r) => r.type === 'style' && r.enabled && isSafeRecordId(r.id))
    .map(
      (r) =>
        `[${MARK_ATTRIBUTE}~="${r.id}"] { ${cssPropertyName(r.property)}: ${r.newValue} !important; }`,
    )
    .join('\n');
}
