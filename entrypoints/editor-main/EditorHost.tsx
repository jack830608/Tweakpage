import { useEffect, useState } from 'react';
import { showMarker } from '../../lib/applier/marker';
import { safeSendMessage } from '../../lib/extension-context';
import type { EditsController } from './controller';
import { EditorApp } from './EditorApp';

interface EditorHostProps {
  controller: EditsController;
  host: HTMLElement;
}

export function EditorHost({ controller, host }: EditorHostProps) {
  const [active, setActive] = useState(true);

  useEffect(() => {
    const onToggle = () => setActive((a) => !a);
    const onDeactivate = () => setActive(false);
    document.addEventListener('pg-editor:toggle', onToggle);
    document.addEventListener('pg-editor:deactivate', onDeactivate);
    return () => {
      document.removeEventListener('pg-editor:toggle', onToggle);
      document.removeEventListener('pg-editor:deactivate', onDeactivate);
    };
  }, []);

  useEffect(() => {
    safeSendMessage({ type: 'pg:state', active });
    // The applier owns the corner marker and yields it while the editor is on screen.
    document.dispatchEvent(new CustomEvent('pg-editor:ui', { detail: { visible: active } }));
    // A shared preview lives nowhere but this tab, so the applier cannot draw its
    // marker; when the panel closes mid-preview, the page still has to say whose
    // edits it is showing.
    if (!active && controller.isPreviewingShared()) {
      const count = controller.getPage().records.filter((r) => r.enabled).length;
      showMarker(document, count, () => setActive(true), { shared: true });
    }
  }, [active, controller]);

  if (!active) return null;
  return <EditorApp controller={controller} host={host} onRequestClose={() => setActive(false)} />;
}
