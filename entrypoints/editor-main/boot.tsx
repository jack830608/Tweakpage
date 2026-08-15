import { createRoot } from 'react-dom/client';
import { watchUrlChanges } from '../../lib/applier/navigation';
import { loadPageEdits } from '../../lib/edits/storage';
import { EditsController } from './controller';
import { EditorHost } from './EditorHost';
import css from './editor.css?inline';

const HOST_ID = 'pg-visual-editor-host';

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
  watchUrlChanges(window, () => {
    document.dispatchEvent(new CustomEvent('pg-editor:deactivate'));
  });
  void loadPageEdits(location.href)
    .catch(() => null)
    .then((initial) => {
      createRoot(container).render(
        <EditorHost controller={new EditsController(initial, document)} host={host} />,
      );
    });
}
