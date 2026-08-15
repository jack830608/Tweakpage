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
}

export function findRecord(
  records: EditRecord[],
  selector: string,
  property: string,
): EditRecord | undefined {
  return records.find((r) => r.selector === selector && r.property === property);
}

export function upsertRecord(records: EditRecord[], edit: NewEdit, now: string): EditRecord[] {
  const existing = findRecord(records, edit.selector, edit.property);
  if (existing) {
    return records.map((r) =>
      r === existing
        ? { ...r, newValue: edit.newValue, elementLabel: edit.elementLabel, updatedAt: now }
        : r,
    );
  }
  return [...records, { id: makeId(), enabled: true, createdAt: now, updatedAt: now, ...edit }];
}
