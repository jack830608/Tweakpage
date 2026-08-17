import { createRoot } from 'react-dom/client';
import { watchUrlChanges } from '../../lib/applier/navigation';
import { loadPageEdits, normalizePageUrl } from '../../lib/edits/storage';
import { EditsController } from './controller';
import { EditorHost } from './EditorHost';
import css from './editor.css?inline';

const HOST_ID = 'tweakpage-host';

export function boot(): void {
  if (document.getElementById(HOST_ID)) return;
  const host = document.createElement('div');
  host.id = HOST_ID;
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
