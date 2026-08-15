import { useEffect, useState } from 'react';
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
  }, [active]);

  if (!active) return null;
  return <EditorApp controller={controller} host={host} onRequestClose={() => setActive(false)} />;
}
