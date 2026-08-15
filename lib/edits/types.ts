export type EditType = 'style' | 'text' | 'attr';

export interface EditRecord {
  id: string;
  selector: string;
  fallbackSelectors: string[];
  textFingerprint?: string;
  elementLabel: string;
  type: EditType;
  property: string;
  oldValue: string;
  newValue: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PageEdits {
  version: 1;
  url: string;
  title: string;
  records: EditRecord[];
  updatedAt: string;
}

export function makeId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function emptyPageEdits(url: string, title: string, now: string): PageEdits {
  return { version: 1, url, title, records: [], updatedAt: now };
}
