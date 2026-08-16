/** Keeps a revealed element clear of the very edge of the viewport. */
const EDGE_MARGIN = 24;

/**
 * Scrolls an element into view before it gets selected.
 *
 * A change in the review list is usually for something far off screen, and selecting it
 * silently looked like nothing had happened. Elements already on screen are left alone,
 * so clicking a change for what you are already looking at doesn't lurch the page.
 */
export function revealElement(el: Element, view: Window = window): void {
  if (typeof el.scrollIntoView !== 'function') return;
  // Clicking the control that triggers this focuses it, and the browser's own
  // scroll-focus-into-view runs after the handler and cancels a smooth scroll started
  // inside it. Waiting a frame lets ours be the one that survives.
  if (typeof view.requestAnimationFrame === 'function') {
    view.requestAnimationFrame(() => scrollTo(el, view));
    return;
  }
  scrollTo(el, view);
}

function scrollTo(el: Element, view: Window): void {
  const rect = el.getBoundingClientRect();
  const height = view.innerHeight || 0;
  const onScreen = rect.top >= EDGE_MARGIN && rect.bottom <= height - EDGE_MARGIN;
  if (onScreen) return;
  const reducedMotion = view.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
  el.scrollIntoView({
    block: 'center',
    inline: 'nearest',
    behavior: reducedMotion ? 'auto' : 'smooth',
  });
}
