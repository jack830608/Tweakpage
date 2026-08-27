/**
 * 'move' reorders an element among its siblings; old/newValue hold its index.
 * 'clone' inserts a copy of the element right after it; the record's id stamps the copy.
 */
import type { ContextNode } from '../selector/context';

export type { ContextNode };

export type EditType = 'style' | 'text' | 'attr' | 'move' | 'clone';

/**
 * Edits that rearrange the page rather than describe one property of it.
 *
 * They are the ones for which selector-and-property is not identity: every copy of a card
 * writes `clone`/`clone` against the same node, so a set of them shares both. Anything
 * deciding whether one record supersedes another has to ask this first.
 */
export const STRUCTURAL = new Set<EditType>(['move', 'clone']);

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
  /** Why this change: written by the author, read by whoever receives the hand-off. */
  note?: string;
  /**
   * Where this element lives, for whoever has to go and change it.
   *
   * A selector proves which element on this page; it does not say which component in a
   * repository. The chain of ancestors does: a CSS Modules class names the file, an
   * aria-label names the region in the author's words. Recorded only — resolution never
   * consults it.
   */
  context?: ContextNode[];
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
