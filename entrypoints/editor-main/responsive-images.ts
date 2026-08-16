import type { EditType } from '../../lib/edits/types';

interface RecordsEdits {
  recordEdit(el: Element, type: EditType, property: string, oldValue: string, newValue: string): void;
}

/**
 * Clears the candidates that outrank `src`, so swapping an image is actually visible.
 *
 * A responsive image carries `srcset`, and inside `<picture>` the `<source>` elements
 * outrank the `<img>` entirely — the browser picks from those and never looks at `src`.
 * Editing only `src` changed the attribute, reported success, and showed the old picture.
 *
 * Each cleared attribute is its own record, so it appears in the change list, exports
 * with the rest, and is put back on reset.
 */
export function clearResponsiveSources(img: Element, controller: RecordsEdits): void {
  const own = img.getAttribute('srcset');
  if (own) controller.recordEdit(img, 'attr', 'srcset', own, '');

  const picture = img.parentElement;
  if (!picture || picture.tagName !== 'PICTURE') return;
  for (const source of Array.from(picture.querySelectorAll('source'))) {
    const candidates = source.getAttribute('srcset');
    if (candidates) controller.recordEdit(source, 'attr', 'srcset', candidates, '');
  }
}
