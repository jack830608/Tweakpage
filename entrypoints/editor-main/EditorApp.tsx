import { useCallback, useState, useSyncExternalStore } from 'react';
import type { EditsController } from './controller';
import { Overlay } from './components/Overlay';
import { useElementPicker } from './hooks/useElementPicker';

export interface EditorAppProps {
  controller: EditsController;
  host: HTMLElement;
  onRequestClose: () => void;
}

export function EditorApp({ controller, host, onRequestClose }: EditorAppProps) {
  useSyncExternalStore(controller.subscribe, controller.getPage);
  const [hovered, setHovered] = useState<Element | null>(null);
  const [selected, setSelected] = useState<Element | null>(null);

  const onHover = useCallback((el: Element | null) => setHovered(el), []);
  const onSelect = useCallback((el: Element) => {
    setSelected(el);
    setHovered(null);
  }, []);
  const onEscape = useCallback(() => {
    setSelected((current) => {
      if (!current) onRequestClose();
      return null;
    });
  }, [onRequestClose]);

  useElementPicker(host, { onHover, onSelect, onEscape });

  const activeSelected = selected?.isConnected ? selected : null;

  return (
    <>
      <Overlay hovered={hovered?.isConnected ? hovered : null} selected={activeSelected} />
      <aside className="pgve-panel">
        <header className="pgve-header">
          <strong>PG Visual Editor</strong>
          <button type="button" onClick={onRequestClose} aria-label="Close">✕</button>
        </header>
        <p className="pgve-empty">
          {activeSelected
            ? `Selected: ${activeSelected.tagName.toLowerCase()}`
            : 'Select an element on the page to edit it.'}
        </p>
      </aside>
    </>
  );
}
