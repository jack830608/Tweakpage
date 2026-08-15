import { useEffect, useState } from 'react';
import { browser } from 'wxt/browser';
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
    document.addEventListener('pg-editor:toggle', onToggle);
    return () => document.removeEventListener('pg-editor:toggle', onToggle);
  }, []);

  useEffect(() => {
    browser.runtime.sendMessage({ type: 'pg:state', active }).catch(() => {});
  }, [active]);

  if (!active) return null;
  return <EditorApp controller={controller} host={host} onRequestClose={() => setActive(false)} />;
}
