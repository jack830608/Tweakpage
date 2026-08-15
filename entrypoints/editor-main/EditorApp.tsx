import { useSyncExternalStore } from 'react';
import type { EditsController } from './controller';

export interface EditorAppProps {
  controller: EditsController;
  host: HTMLElement;
  onRequestClose: () => void;
}

export function EditorApp({ controller, onRequestClose }: EditorAppProps) {
  useSyncExternalStore(controller.subscribe, controller.getPage);
  return (
    <aside className="pgve-panel">
      <header className="pgve-header">
        <strong>PG Visual Editor</strong>
        <button type="button" onClick={onRequestClose} aria-label="Close">✕</button>
      </header>
      <p className="pgve-empty">Select an element on the page to edit it.</p>
    </aside>
  );
}
