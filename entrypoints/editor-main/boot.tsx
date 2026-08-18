import { createRoot } from 'react-dom/client';
import { watchUrlChanges } from '../../lib/applier/navigation';
import { loadPageEdits, normalizePageUrl } from '../../lib/edits/storage';
import { EditsController } from './controller';
import { EditorHost } from './EditorHost';
import css from './editor.css?inline';

const HOST_ID = 'tweakpage-host';

/** The declarations a page must not be able to change on our own host element. */
const HOST_DEFENCES: Record<string, string> = {
  all: 'initial',
  position: 'fixed',
  top: '0',
  left: '0',
  width: '0',
  height: '0',
  overflow: 'visible',
  visibility: 'visible',
  opacity: '1',
  'z-index': '2147483647',
  display: 'block',
  transform: 'none',
  filter: 'none',
  'clip-path': 'none',
};

export function applyHostDefences(host: HTMLElement): void {
  // `all` first: it resets everything, so anything after it survives.
  for (const [property, value] of Object.entries(HOST_DEFENCES)) {
    host.style.setProperty(property, value, 'important');
  }
}

export function boot(): void {
  if (document.getElementById(HOST_ID)) return;
  const host = document.createElement('div');
  host.id = HOST_ID;
  // The shadow root protects what is inside it; the host itself sits in the page's tree,
  // where a `div { display: none }` or a blanket `* { visibility: hidden }` reaches it
  // and takes the whole editor with it. Inline !important is the one declaration a page
  // stylesheet cannot outrank.
  applyHostDefences(host);
  // Deliberately open. A closed root looks like a boundary and is not one — a site that
  // patched attachShadow before we ran holds the root either way — while it does blind
  // every real-browser test we have of this panel. The boundary that matters is what we
  // put in here: nothing a site could want. Credentials live on the options page.
  const shadow = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = css;
  const container = document.createElement('div');
  shadow.append(style, container);
  document.documentElement.appendChild(host);
  let lastPage = normalizePageUrl(location.href);
  watchUrlChanges(window, (url) => {
    // Anchors and query changes keep the same storage key. A real route change used to
    // close the editor, which meant reopening it from the toolbar after every link.
    const nextPage = normalizePageUrl(url);
    if (nextPage === lastPage) return;
    lastPage = nextPage;
    document.dispatchEvent(new CustomEvent('tweakpage:navigated', { detail: { url } }));
  });
  void loadPageEdits(location.href)
    .catch(() => null)
    .then((initial) => {
      createRoot(container).render(
        <EditorHost controller={new EditsController(initial, document)} host={host} />,
      );
    });
}
