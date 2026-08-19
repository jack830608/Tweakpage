import { buildCssText, isSafeRecordId, MARK_ATTRIBUTE } from './css';
import { applyDomEdit, revertDomEdit } from './dom';
import type { EditRecord as Record } from './types';
import type { EditRecord } from './types';
import { rememberWritten, resolveRecord, textStillMatches } from '../selector/resolve';

const STYLE_TAG_SELECTOR = 'style[data-tweakpage-style]';
const MARKED_SELECTOR = `[${MARK_ATTRIBUTE}]`;

export type ApplyStatus = 'applied' | 'not-found' | 'disabled';

export function ensureStyleTag(doc: Document): HTMLStyleElement {
  let tag = doc.querySelector<HTMLStyleElement>(STYLE_TAG_SELECTOR);
  if (!tag) {
    tag = doc.createElement('style');
    tag.setAttribute('data-tweakpage-style', '');
    (doc.head ?? doc.documentElement).appendChild(tag);
  }
  return tag;
}

const STRUCTURAL = new Set<EditRecord['type']>(['move', 'clone']);

/**
 * True for a record whose selector describes the page AFTER our own structural edits.
 *
 * A selector is minted against the page as it looked when the user clicked. Once
 * Tweakpage has moved or copied something, that is no longer the page a fresh load
 * produces — so a positional selector minted afterwards means a different element
 * there, and resolving it early picks the wrong one, silently. Such records wait until
 * the structural edits have been replayed and the page looks the way they remember.
 */
function mintedAfterStructure(record: EditRecord, structureTime: string | null): boolean {
  return structureTime !== null && !STRUCTURAL.has(record.type) && record.createdAt > structureTime;
}

export function applyAll(records: EditRecord[], doc: Document): Map<string, ApplyStatus> {
  const statuses = new Map<string, ApplyStatus>();
  const marks = new Map<Element, string[]>();
  const applied: EditRecord[] = [];
  const structureTime = records
    .filter((r) => r.enabled && STRUCTURAL.has(r.type))
    .reduce<string | null>((latest, r) => (latest === null || r.createdAt > latest ? r.createdAt : latest), null);
  const deferred: EditRecord[] = [];

  // Resolve first, mutate after: a move mid-loop shifts the nth positions every later
  // selector counts on, so no record may touch the page until all of them have found
  // their element on the page as it was.
  const resolved: Array<{ record: EditRecord; targets: Element[] }> = [];
  for (const record of records) {
    if (!record.enabled) {
      statuses.set(record.id, 'disabled');
      continue;
    }
    if (record.type !== 'text' && record.type !== 'attr' && !isSafeRecordId(record.id)) {
      statuses.set(record.id, 'not-found');
      continue;
    }
    if (mintedAfterStructure(record, structureTime)) {
      deferred.push(record);
      continue;
    }
    // A 'similar' edit is aimed at a family on purpose, so every match gets the mark.
    const targets =
      record.scope === 'similar' && record.type === 'style'
        ? matchAll(doc, record.selector)
        : [resolveTarget(record, doc)].filter((el): el is Element => el !== null);
    if (targets.length === 0) {
      statuses.set(record.id, 'not-found');
      continue;
    }
    resolved.push({ record, targets });
    applied.push(record);
    statuses.set(record.id, 'applied');
  }

  for (const { record, targets } of resolved) {
    if (record.type === 'move') continue;
    for (const el of targets) {
      if (record.type !== 'style') writeDomEdit(el, record);
      // Every applied record is mark-bound to its node from here on (see resolveTarget):
      // a clone inserting a sibling shifts every nth position after it, and on the next
      // pass only the mark still says which element each record meant.
      marks.set(el, [...(marks.get(el) ?? []), record.id]);
    }
  }
  // Moves run last, lowest target index first: placing an element never disturbs the
  // ones already placed below it, so the set lands exactly as arranged.
  for (const { record, targets } of byIndex(resolved, (r) => r.newValue)) {
    for (const el of targets) {
      writeDomEdit(el, record);
      marks.set(el, [...(marks.get(el) ?? []), record.id]);
    }
  }

  // Second round, against the page as the record remembers it. Two kinds land here:
  // records minted after a move or a copy rearranged things, and records aimed inside a
  // copy that could not exist until the copy did. The share preview applies through the
  // controller — no observer, no second chance — so this happens in the same call.
  const late = [
    ...deferred,
    ...(resolved.some(({ record }) => record.type === 'clone')
      ? records.filter((r) => statuses.get(r.id) === 'not-found' && !STRUCTURAL.has(r.type))
      : []),
  ];
  for (const record of late) {
    if (record.scope === 'similar' && record.type === 'style') {
      const targets = matchAll(doc, record.selector);
      if (targets.length === 0) {
        statuses.set(record.id, 'not-found');
        continue;
      }
      for (const el of targets) marks.set(el, [...(marks.get(el) ?? []), record.id]);
      applied.push(record);
      statuses.set(record.id, 'applied');
      continue;
    }
    const el = resolveTarget(record, doc);
    if (!el) {
      statuses.set(record.id, 'not-found');
      continue;
    }
    if (record.type !== 'style') writeDomEdit(el, record);
    marks.set(el, [...(marks.get(el) ?? []), record.id]);
    applied.push(record);
    statuses.set(record.id, 'applied');
  }

  syncMarks(doc, marks);

  // Only edits that resolved get a rule, so "applied" in the list and "styled" on the
  // page can no longer drift apart.
  const css = buildCssText(applied);
  if (css) {
    const tag = ensureStyleTag(doc);
    if (tag.textContent !== css) tag.textContent = css;
  } else {
    doc.querySelector(STYLE_TAG_SELECTOR)?.remove();
  }
  return statuses;
}

/**
 * The node the previous apply stamped is exactly the element the record meant: moves
 * and clones rearrange the order every positional selector was minted against, and an
 * element with no text has no fingerprint to be recognised by. The mark is checked
 * first for that reason; a fresh page has no marks, and there the selector still
 * speaks for the original arrangement.
 */
function resolveTarget(record: Record, doc: Document): Element | null {
  if (isSafeRecordId(record.id)) {
    const marked = matchAll(doc, `[${MARK_ATTRIBUTE}~="${record.id}"]`);
    // The mark says "the node we stamped last pass", which is not the same as "still the
    // element this record meant". A framework that keeps its nodes and swaps their words
    // hands our mark to somebody else's content, and the edit follows it.
    if (marked.length === 1 && textStillMatches(record, marked[0])) return marked[0];
  }
  return resolveRecord(record, doc);
}

/** Applies, then remembers the words it left behind. See rememberWritten. */
function writeDomEdit(el: Element, record: Record): void {
  applyDomEdit(el, record);
  rememberWritten(el, record.id);
}

/** The move records of a set, lowest index first; ties keep record order. */
function byIndex(
  resolved: Array<{ record: Record; targets: Element[] }>,
  index: (record: Record) => string,
): Array<{ record: Record; targets: Element[] }> {
  return resolved
    .filter(({ record }) => record.type === 'move')
    .sort((a, b) => Number(index(a.record)) - Number(index(b.record)));
}

function matchAll(doc: Document, selector: string): Element[] {
  try {
    return Array.from(doc.querySelectorAll(selector));
  } catch {
    return [];
  }
}

/** Writes only what changed: an unchanged setAttribute still notifies observers. */
function syncMarks(doc: Document, marks: Map<Element, string[]>): void {
  for (const el of Array.from(doc.querySelectorAll(MARKED_SELECTOR))) {
    if (!marks.has(el)) el.removeAttribute(MARK_ATTRIBUTE);
  }
  for (const [el, ids] of marks) {
    const value = ids.join(' ');
    if (el.getAttribute(MARK_ATTRIBUTE) !== value) el.setAttribute(MARK_ATTRIBUTE, value);
  }
}

/**
 * Undoes the edits that were applied and are not in the new set.
 *
 * Style edits need no help — the injected stylesheet is rewritten wholesale — but text
 * and attribute edits changed the page itself, so dropping them from the set leaves the
 * old change sitting on screen until something reloads the page.
 */
export function revertRemoved(previous: EditRecord[], next: EditRecord[], doc: Document): void {
  const doomed = previous.filter((record) => {
    if (record.type === 'style' || !record.enabled) return false;
    // By id, for every kind. Selector-and-property was only ever a guess at identity,
    // and two records can share both — a wizard step re-labelled in place produces
    // exactly that. Deleting one then looked like it was still there, so the page kept
    // the words with nothing in the change list accounting for them.
    return !next.some((r) => r.id === record.id && r.enabled);
  });
  revertInOrder(doomed, doc);
}

/**
 * The reverse of applying, step for step.
 *
 * Apply inserts copies and then places moves, lowest target first. Undoing it the same
 * way round removed the copy before the move's index was read — and that index had been
 * measured in a page that still had the copy in it, so the element went back to a
 * position that no longer meant what it did. Reverting a duplicate-then-reorder left the
 * page in an order it had never been in.
 *
 * So: moves first, highest target first, then everything else.
 */
function revertInOrder(records: EditRecord[], doc: Document): void {
  const moves = records
    .filter((r) => r.type === 'move')
    .sort((a, b) => Number(b.newValue) - Number(a.newValue));
  for (const record of [...moves, ...records.filter((r) => r.type !== 'move')]) {
    const el = resolveTarget(record, doc);
    if (el) revertDomEdit(el, record);
  }
}

export function revertAll(records: EditRecord[], doc: Document): void {
  doc.querySelector(STYLE_TAG_SELECTOR)?.remove();
  // Undone while the marks still exist — a moved element with no text is findable only
  // by its mark. Only then are the marks stripped.
  revertInOrder(records.filter((r) => r.type !== 'style'), doc);
  for (const el of Array.from(doc.querySelectorAll(MARKED_SELECTOR))) {
    el.removeAttribute(MARK_ATTRIBUTE);
  }
}
