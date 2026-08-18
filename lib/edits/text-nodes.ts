/** Records addressing one text run inside an element carry this property prefix. */
export const TEXT_NODE_PREFIX = 'textNode:';

/** More fields than this stops being an editor and starts being a wall. */
export const MAX_RUNS = 12;

/**
 * True when every run of this element can be addressed by a record.
 *
 * Past the cap, textRuns stops numbering — so a change to a later run has no property
 * to be recorded under. The panel simply doesn't offer those boxes; inline editing has
 * to refuse the element outright, or typing looks like it worked and vanishes on reload.
 */
export function allRunsAddressable(el: Element): boolean {
  let count = 0;
  const walker = el.ownerDocument.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if ((node.nodeValue ?? '').trim().length > 0 && ++count > MAX_RUNS) return false;
  }
  return true;
}

export interface TextRun {
  index: number;
  node: Text;
  /** Where the run sits, e.g. "span" for `<h1>Make the page <span>yours</span></h1>`. */
  label: string;
}

export function textNodeProperty(index: number): string {
  return `${TEXT_NODE_PREFIX}${index}`;
}

export function textNodeIndex(property: string): number | null {
  if (!property.startsWith(TEXT_NODE_PREFIX)) return null;
  const index = Number(property.slice(TEXT_NODE_PREFIX.length));
  return Number.isInteger(index) && index >= 0 ? index : null;
}

/**
 * The runs of visible text inside an element, in document order.
 *
 * Setting textContent on a heading that holds a coloured `<span>` replaces the markup
 * with a flat string — the highest-frequency edit quietly destroying the design. Editing
 * one run at a time leaves the markup where it is.
 */
export function textRuns(el: Element): TextRun[] {
  const runs: TextRun[] = [];
  const walker = el.ownerDocument.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let index = 0;
  let node = walker.nextNode();
  while (node && runs.length < MAX_RUNS) {
    const text = node as Text;
    if ((text.nodeValue ?? '').trim().length > 0) {
      runs.push({ index, node: text, label: labelFor(el, text) });
      index++;
    }
    node = walker.nextNode();
  }
  return runs;
}

/** Resolves the nth run again at apply time, when only the element is known. */
export function textNodeAt(el: Element, index: number): Text | null {
  return textRuns(el)[index]?.node ?? null;
}

/** True when editing the whole element would flatten markup. */
export function hasInlineMarkup(el: Element): boolean {
  return el.firstElementChild !== null && textRuns(el).length > 1;
}

function labelFor(el: Element, node: Text): string {
  const parent = node.parentElement;
  if (!parent || parent === el) return el.tagName.toLowerCase();
  const chain: string[] = [];
  for (let cursor: Element | null = parent; cursor && cursor !== el; cursor = cursor.parentElement) {
    chain.unshift(cursor.tagName.toLowerCase());
  }
  return chain.join(' > ');
}
