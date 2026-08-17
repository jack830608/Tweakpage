/** 'move' reorders an element among its siblings; old/newValue hold its index. */
export type EditType = 'style' | 'text' | 'attr' | 'move';

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
  /**
   * The attribute did not exist before the edit. oldValue can't say so — '' is a legal
   * attribute value — and without it, resetting an added href left href="" behind,
   * turning an inert element into a link to the current page.
   */
  absent?: boolean;
  enabled: boolean;
  scope?: EditScope;
  /** Viewport width when the edit was made — an engineer needs it to place the change. */
  viewport?: number;
  createdAt: string;
  updatedAt: string;
}

/** A saved set of edits kept beside the live one, so two proposals can be compared. */
export interface Variant {
  id: string;
  name: string;
  records: EditRecord[];
  savedAt: string;
}

export interface PageEdits {
  version: 1;
  url: string;
  title: string;
  records: EditRecord[];
  /** Travels with the export, so a colleague receives every proposal, not just the live one. */
  variants?: Variant[];
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
