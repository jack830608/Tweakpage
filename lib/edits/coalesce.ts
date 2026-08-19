import { makeId, type EditRecord } from './types';

export interface NewEdit {
  selector: string;
  fallbackSelectors: string[];
  textFingerprint?: string;
  elementLabel: string;
  type: EditRecord['type'];
  property: string;
  oldValue: string;
  newValue: string;
  absent?: boolean;
  viewport?: number;
}

export function findRecord(
  records: EditRecord[],
  selector: string,
  property: string,
): EditRecord | undefined {
  return records.find((r) => r.selector === selector && r.property === property);
}

/**
 * `existing` is passed in rather than looked up here.
 *
 * Two elements of the same shape in the same place mint the same selector — one list of
 * buttons re-labelled at every step of a wizard does it — so selector plus property does
 * not name a record. Only the caller, which has the element, can say which record is
 * being continued, and finding it here again was how typing on the second element
 * rewrote the first one's edit.
 */
export function upsertRecord(
  records: EditRecord[],
  edit: NewEdit,
  now: string,
  existing: EditRecord | undefined,
): EditRecord[] {
  if (existing) {
    return records.map((r) =>
      r === existing
        ? { ...r, newValue: edit.newValue, elementLabel: edit.elementLabel, viewport: edit.viewport ?? r.viewport, updatedAt: now }
        : r,
    );
  }
  return [...records, { id: makeId(), enabled: true, createdAt: now, updatedAt: now, ...edit }];
}
