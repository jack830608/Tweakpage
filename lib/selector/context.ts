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
  return chain;
}
