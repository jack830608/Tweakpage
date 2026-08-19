import { escapeIdent } from './escape';
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
  const classes = Array.from(el.classList).filter(isStableClass).map(escapeIdent);
  const tag = el.tagName.toLowerCase();
  // A Tailwind variant carries a colon, which is not a selector until it is escaped.
  // Unescaped, every class candidate threw, the throw was swallowed, and the offer fell
  // through to the bare tag: "the two cards like this one" became "every button on the
  // page", one click away from restyling a family the user never meant. An element with
  // classes is only ever offered its class family; the tag alone is a different promise
  // and is not made on its behalf.
  const candidates =
    classes.length > 0
      ? [`${tag}.${classes.join('.')}`, `.${classes.join('.')}`]
      : [tag];

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
