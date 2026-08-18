import { isTweakpageNode } from '../../lib/edits/dom';
import { hasInlineMarkup, textNodeProperty, textRuns } from '../../lib/edits/text-nodes';
import { hasDirectText } from './components/sections/TextSection';
import type { EditsController } from './controller';

/**
 * Editing text where it lives, instead of in the panel.
 *
 * The element itself becomes the input: contenteditable="plaintext-only", so typing and
 * pasting can only ever change text nodes — Enter inserts a newline, paste sheds its
 * markup — and the element's own structure (the link inside a heading, the coloured
 * span) cannot be damaged by the keyboard.
 *
 * Nothing is recorded until the edit is finished (blur, Esc, clicking away). The commit
 * then diffs each text run against where it started and routes the changes through the
 * same recordEdit the panel uses — same property names, so the panel's boxes, undo,
 * coalescing and "typing the original back deletes the record" all behave as if the
 * text had been edited there.
 */
export interface InlineEditSession {
  element: Element;
  /** Diffs, records, and puts the element back to normal. Safe to call once. */
  finish(): void;
}

export function canEditInline(el: Element): boolean {
  if (isTweakpageNode(el)) return false;
  // Form fields and things the page already made editable have their own text story.
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) {
    return false;
  }
  if ((el as HTMLElement).isContentEditable) return false;
  return hasDirectText(el);
}

export function startInlineEdit(
  el: Element,
  controller: EditsController,
  onUnrecordable: () => void = () => {},
): InlineEditSession {
  const doc = el.ownerDocument;
  const markup = hasInlineMarkup(el);
  // Node positions, not run indices: a run typed down to nothing disappears from
  // textRuns, but the node itself survives plaintext-only editing, so pairing by
  // position among ALL text nodes stays stable where run numbering would slip.
  const entry = allTextNodes(el);
  const entryValues = entry.map((node) => node.nodeValue ?? '');
  const runIndexByPosition = runPositions(el);

  const hadAttribute = el.getAttribute('contenteditable');
  // Our editing outline is the affordance; the browser's focus ring on top of it reads
  // as a second, unexplained selection. Saved and restored via the style attribute so a
  // page's own inline outline comes back exactly as it was.
  const hadStyle = el.getAttribute('style');
  el.setAttribute('contenteditable', 'plaintext-only');
  (el as HTMLElement).style.outline = 'none';
  // The applier reapplies records on every mutation — with a keystroke being a
  // mutation, it would rewrite the element under the user's caret.
  doc.dispatchEvent(new CustomEvent('tweakpage:editing', { detail: { on: true } }));
  (el as HTMLElement).focus({ preventScroll: true });

  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    if (hadAttribute === null) el.removeAttribute('contenteditable');
    else el.setAttribute('contenteditable', hadAttribute);
    if (hadStyle === null) el.removeAttribute('style');
    else el.setAttribute('style', hadStyle);
    // Diff and record BEFORE releasing the applier: the moment it wakes it reapplies
    // records over this element, and a release-then-diff read a page that no longer
    // held the typing.
    record();
    doc.dispatchEvent(new CustomEvent('tweakpage:editing', { detail: { on: false } }));
  };

  const record = () => {
    const now = allTextNodes(el);
    if (markup) {
      if (now.length !== entry.length) {
        // The structure changed despite plaintext-only — an extension or the page
        // itself interfered. Recording positional guesses would edit the wrong runs.
        onUnrecordable();
        return;
      }
      for (let position = 0; position < now.length; position++) {
        const runIndex = runIndexByPosition.get(position);
        if (runIndex === undefined) continue; // was whitespace-only at entry; stays unaddressable
        commitOne(
          controller,
          el,
          textNodeProperty(runIndex),
          entryValues[position],
          now[position].nodeValue ?? '',
        );
      }
      return;
    }
    commitOne(controller, el, 'textContent', entryValues.join(''), el.textContent ?? '');
  };

  return { element: el, finish };
}

/** Mirrors the panel: oldValue is the record's original when one exists. */
function commitOne(
  controller: EditsController,
  el: Element,
  property: string,
  entryValue: string,
  newValue: string,
): void {
  const record = controller.recordFor(el, property);
  const effective = record?.newValue ?? entryValue;
  // An untouched run stays silent — recording it would only push an empty undo step.
  if (newValue === effective) return;
  controller.recordEdit(el, 'text', property, record?.oldValue ?? entryValue, newValue);
}

function allTextNodes(el: Element): Text[] {
  const walker = el.ownerDocument.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  let node = walker.nextNode();
  while (node) {
    nodes.push(node as Text);
    node = walker.nextNode();
  }
  return nodes;
}

/** Maps a node's position among all text nodes to its run index, as numbered at entry. */
function runPositions(el: Element): Map<number, number> {
  const nodes = allTextNodes(el);
  const runs = textRuns(el);
  const map = new Map<number, number>();
  for (const run of runs) {
    const position = nodes.indexOf(run.node);
    if (position !== -1) map.set(position, run.index);
  }
  return map;
}
