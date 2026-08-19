import { CLONE_ATTRIBUTE } from '../edits/dom';
import { textNodeIndex } from '../edits/text-nodes';
import type { EditRecord } from '../edits/types';

type Resolvable = Pick<EditRecord, 'selector' | 'fallbackSelectors' | 'textFingerprint'> &
  Partial<Pick<EditRecord, 'type' | 'property' | 'newValue'>>;

/**
 * Finds the element a record was made against — the remembered element, not merely
 * whatever its selector matches today.
 *
 * A structural selector like p:nth-of-type(2) proves uniqueness, not identity: after the
 * site inserts a sibling above the target, it uniquely names an element the user never
 * picked, and an edit applied there rewrites the wrong part of someone's page. So a
 * selector hit is held against the remembered text before it is believed:
 *
 * 1. The hit shows the fingerprint, or the applied edit's own text → it is the element.
 * 2. Otherwise, if exactly one element elsewhere shows the remembered text (original or
 *    applied), the record has drifted — follow the text, not the position.
 * 3. Otherwise the text exists nowhere, which is what a live page rewriting its own
 *    content looks like — the hit is trusted, and the baseline refresh deals with the
 *    value having moved on. Refusing the hit here would stop edits from replaying on any
 *    page with dynamic content.
 */
export function resolveRecord(record: Resolvable, root: Document | Element): Element | null {
  // A selector anchored to a copy's stamp resolves inside that copy or not at all.
  // Before the copy exists, "helpful" fingerprint relocation would land on the
  // original's twin — the copy's whole subtree is textually identical to it. The stamp
  // IS the identity here; not-found simply means the copy hasn't been made yet.
  if (record.selector.startsWith(`[${CLONE_ATTRIBUTE}`)) {
    return queryUnique(root, record.selector);
  }
  const identities = rememberedTexts(record);
  for (const selector of [record.selector, ...record.fallbackSelectors]) {
    const el = queryUnique(root, selector);
    if (!el) continue;
    if (identities.length === 0 || identities.includes(textOf(el))) return el;
    const moved = relocated(record, root, identities);
    if (moved) return moved;
    // A unique match is not the same as the right element. Where the words are the
    // identity, one reading something else belongs to somebody else — a wizard that
    // re-labels one list of buttons at every step put a single edit on every step.
    // Everything else sits on text that is free to change and keeps the match.
    if (isTextIdentified(record) && !ourOwnHandiwork(el)) continue;
    return el;
  }
  return relocated(record, root, identities);
}

/**
 * Whether this record's element is recognised by its words.
 *
 * Only whole-element text edits are: the text is both what they carry and what names
 * them. A style, attribute, move or clone record sits on an element whose text may
 * legitimately change — a price, a counter, a translation — and holding those to it
 * would drop edits that are perfectly fine. A per-run text edit leaves the other runs
 * in place, so the element's full text cannot be reconstructed here to compare.
 */
/**
 * The text this module last wrote into an element.
 *
 * Between two passes an element's words can change for two reasons that need opposite
 * answers: the user typed another character, so the record has moved on while the page
 * still shows what we wrote last — or the page replaced the words itself, and this is
 * no longer the element the record meant. The DOM cannot tell those apart. Only
 * remembering what we put there can.
 *
 * Keyed by node, so an element the page replaced starts with no memory of us.
 */
const lastWritten = new WeakMap<Element, string>();

export function rememberWritten(el: Element): void {
  lastWritten.set(el, textOf(el));
}

/** Is this element still showing exactly what we last put in it? */
function ourOwnHandiwork(el: Element): boolean {
  return lastWritten.get(el) === textOf(el);
}

export function isTextIdentified(record: Resolvable): boolean {
  return (
    record.type === 'text' &&
    record.property !== undefined &&
    textNodeIndex(record.property) === null &&
    // No fingerprint, nothing to be recognised by: an element with no text when it was
    // picked, or a record written before fingerprints existed. Those keep trusting the
    // selector, which is all they ever had.
    !!record.textFingerprint
  );
}

/** Can this element still be the one the record meant? */
export function textStillMatches(record: Resolvable, el: Element): boolean {
  if (!isTextIdentified(record)) return true;
  // Mid-edit the element carries the previous keystroke's value, which is neither the
  // fingerprint nor the record's current one. We wrote it, so it is still our element.
  if (ourOwnHandiwork(el)) return true;
  const identities = rememberedTexts(record);
  return identities.length === 0 || identities.includes(textOf(el));
}

/** The texts under which the element could legitimately appear right now. */
function rememberedTexts(record: Resolvable): string[] {
  const texts = record.textFingerprint ? [record.textFingerprint] : [];
  // A whole-element text edit replaces textContent, so once applied, the element is
  // recognised by its new text. Per-run edits leave the other runs in place and cannot
  // be reconstructed here; the original fingerprint has to carry them.
  if (record.type === 'text' && record.property !== undefined && textNodeIndex(record.property) === null) {
    const applied = record.newValue?.trim().slice(0, 60);
    if (applied && !texts.includes(applied)) texts.push(applied);
  }
  return texts;
}

function relocated(record: Resolvable, root: Document | Element, identities: string[]): Element | null {
  const tag = tagForRecord(record);
  if (!tag) return null;
  for (const text of identities) {
    const matches = Array.from(root.querySelectorAll(tag)).filter((el) => textOf(el) === text);
    if (matches.length === 1) return matches[0];
  }
  return null;
}

const textOf = (el: Element): string => el.textContent?.trim().slice(0, 60) ?? '';

function queryUnique(root: Document | Element, selector: string): Element | null {
  let matches: NodeListOf<Element>;
  try {
    matches = root.querySelectorAll(selector);
  } catch {
    return null;
  }
  return matches.length === 1 ? matches[0] : null;
}

function tagForRecord(record: Resolvable): string | null {
  for (const selector of [record.selector, ...record.fallbackSelectors]) {
    const tag = tagFromSelector(selector);
    if (tag) return tag;
  }
  return null;
}

function tagFromSelector(selector: string): string | null {
  const last = selector.split(/[\s>]+/).filter(Boolean).pop() ?? '';
  const m = last.match(/^[a-z][a-z0-9-]*/i);
  return m ? m[0].toLowerCase() : null;
}
