import { Fragment } from 'react';
import { isStableClass } from '../../../lib/selector/stable-class';

interface BreadcrumbProps {
  element: Element;
  onSelect: (el: Element) => void;
}

export function getBreadcrumb(el: Element): Element[] {
  const chain: Element[] = [];
  let cur: Element | null = el;
  while (cur && cur.tagName !== 'HTML' && chain.length < 4) {
    chain.unshift(cur);
    cur = cur.parentElement;
  }
  const child = el.firstElementChild;
  return child ? [...chain, child] : chain;
}

/**
 * What to call one step of the path.
 *
 * Bare tag names — body, div, span — name nothing a person who did not write the page
 * recognises. An id or an authored class does, and the page usually has one somewhere in
 * the chain even when it has none on the element itself.
 */
function crumbName(el: Element): string {
  const tag = el.tagName.toLowerCase();
  if (el.id) return `#${el.id}`;
  const cls = Array.from(el.classList).find(isStableClass);
  return cls ? `.${cls}` : tag;
}

export function Breadcrumb({ element, onSelect }: BreadcrumbProps) {
  const chain = getBreadcrumb(element);
  return (
    <div className="twk-breadcrumb">
      {chain.map((el, i) => (
        <Fragment key={i}>
          {/* The one step that goes downwards is marked as such. Appended to the
              ancestors with nothing between them, the selected element came out in the
              middle of its own path, which every breadcrumb convention says is where
              you are not. */}
          {el !== element && i > 0 && chain[i - 1] === element && (
            <span className="twk-crumb-down" aria-hidden="true">
              ↓
            </span>
          )}
          <button
            type="button"
            className={el === element ? 'twk-crumb-active' : ''}
            title={el.tagName.toLowerCase()}
            onClick={() => onSelect(el)}
          >
            {crumbName(el)}
          </button>
        </Fragment>
      ))}
    </div>
  );
}
