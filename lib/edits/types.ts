export type EditType = 'style' | 'text' | 'attr';

/** 'similar' points a style edit at every element the selector matches, not just one. */
export type EditScope = 'element' | 'similar';

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
  scope?: EditScope;
  /** Viewport width when the edit was made — an engineer needs it to place the change. */
  viewport?: number;
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
