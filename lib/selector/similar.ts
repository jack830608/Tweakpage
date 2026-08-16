import { isStableClass } from './stable-class';

export interface SimilarSet {
  selector: string;
  count: number;
}

/**
 * A selector for "the other elements like this one" — every button in a row of cards,
 * every price, every card title.
 *
 * Recorded edits address a single element on purpose, which makes "change all the
 * buttons" impossible one click at a time. This finds the family the element belongs
 * to, so an edit can be pointed at the whole set deliberately rather than by accident.
 */
export function similarSelector(el: Element): SimilarSet | null {
  const doc = el.ownerDocument;
  const classes = Array.from(el.classList).filter(isStableClass);
  const candidates = [
    classes.length > 0 ? `${el.tagName.toLowerCase()}.${classes.join('.')}` : null,
    classes.length > 0 ? `.${classes.join('.')}` : null,
    el.tagName.toLowerCase(),
  ].filter((s): s is string => s !== null);

  for (const selector of candidates) {
    let matches: NodeListOf<Element>;
    try {
      matches = doc.querySelectorAll(selector);
    } catch {
      continue;
    }
    // Two is a family; the whole document's worth of <div> is not a useful offer.
    if (matches.length > 1 && matches.length <= 100 && Array.from(matches).includes(el)) {
      return { selector, count: matches.length };
    }
  }
  return null;
}
