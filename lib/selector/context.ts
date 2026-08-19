import { sourceClassName } from './stable-class';

/**
 * One step of the chain from the edited element outwards.
 *
 * The element itself is usually bare — on the page that prompted this it was a `<span>`
 * with no class, no id and no attributes, which is exactly why its selector came out as
 * `button:nth-of-type(2) > span`. Everything that says where this lives in the codebase
 * was on its ancestors: a CSS Modules class naming the component, and an aria-label
 * carrying the question in the author's own words.
 *
 * Recorded for whoever receives the hand-off, never used to find the element again.
 * Resolution is the selectors' job, and giving these a vote would mean more chances to
 * land on the wrong element, not fewer.
 */
export interface ContextNode {
  tag: string;
  id?: string;
  role?: string;
  /** aria-label: on a well-built page, the region named by the person who built it. */
  label?: string;
  /** data-testid and its cousins — the most greppable thing a page can carry. */
  testId?: string;
  /** Authored class names, build hashes removed. See sourceClassName. */
  classes?: string[];
  /**
   * The heading this element sits under. Recorded on the element's own entry, since it
   * is a fact about where the element is rather than about any one ancestor.
   *
   * Measured across eight real sites: an ancestor carrying an id, a role or an
   * aria-label was there for 8% of elements on Nuxt and 13% on Tailwind's own site,
   * where classes are utilities and nothing is named. A heading above the element was
   * there for 19 of 20 and 18 of 20. It is also the most durable thing on the page —
   * copy outlives markup — and it is what a person would say if you asked them where on
   * the page they meant.
   */
  heading?: string;
}

export const MAX_CONTEXT_DEPTH = 6;
const MAX_CLASSES = 8;
const MAX_LABEL = 120;
const MAX_VALUE = 60;

const TEST_ID_ATTRIBUTES = ['data-testid', 'data-test-id', 'data-test', 'data-cy', 'data-qa'];

function clip(value: string | null, limit: number): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed.slice(0, limit) : undefined;
}

function describe(el: Element): ContextNode {
  const classes = Array.from(el.classList)
    .map(sourceClassName)
    .filter((cls): cls is string => cls !== null)
    .slice(0, MAX_CLASSES);
  const testId = TEST_ID_ATTRIBUTES.map((name) => el.getAttribute(name)).find(Boolean) ?? null;
  return {
    tag: el.tagName.toLowerCase(),
    ...(clip(el.id, MAX_VALUE) ? { id: clip(el.id, MAX_VALUE) } : {}),
    ...(clip(el.getAttribute('role'), MAX_VALUE) ? { role: clip(el.getAttribute('role'), MAX_VALUE) } : {}),
    ...(clip(el.getAttribute('aria-label'), MAX_LABEL)
      ? { label: clip(el.getAttribute('aria-label'), MAX_LABEL) }
      : {}),
    ...(clip(testId, MAX_VALUE) ? { testId: clip(testId, MAX_VALUE) } : {}),
    ...(classes.length > 0 ? { classes } : {}),
  };
}

const HEADINGS = 'h1, h2, h3, h4, h5, h6, [role="heading"]';

/**
 * The nearest heading above this element: back through earlier siblings, then out
 * through ancestors — the way a reader works out what part of a page they are in.
 *
 * Deliberately not bounded by MAX_CONTEXT_DEPTH. That bound is about how much of the
 * chain is worth recording; a heading twelve levels up is just as good an answer as one
 * two levels up, and on deeply nested documentation the deep one is the only answer
 * there is.
 */
function nearestHeading(el: Element): string | undefined {
  for (let cursor: Element | null = el; cursor; cursor = cursor.parentElement) {
    // The element may be inside the heading rather than after it — a chip in an <h2>,
    // a link in a title. Looking only backwards walked straight past it.
    if (cursor !== el && cursor.matches(HEADINGS)) {
      const own = clip(cursor.textContent, MAX_LABEL);
      if (own) return own;
    }
    for (
      let sibling = cursor.previousElementSibling;
      sibling;
      sibling = sibling.previousElementSibling
    ) {
      const found = sibling.matches(HEADINGS)
        ? sibling
        : // The last one inside it, which is the one nearest to us.
          [...sibling.querySelectorAll(HEADINGS)].pop();
      const text = clip(found?.textContent ?? null, MAX_LABEL);
      if (text) return text;
    }
  }
  return undefined;
}

/** The element first, then its ancestors, stopping at the document. */
export function buildContext(el: Element): ContextNode[] {
  const chain: ContextNode[] = [];
  let cursor: Element | null = el;
  while (cursor && chain.length < MAX_CONTEXT_DEPTH) {
    const tag = cursor.tagName.toLowerCase();
    if (tag === 'body' || tag === 'html') break;
    chain.push(describe(cursor));
    cursor = cursor.parentElement;
  }
  const heading = nearestHeading(el);
  if (heading && chain[0]) chain[0].heading = heading;
  return chain;
}
