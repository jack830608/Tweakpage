import { useCallback, useState, useSyncExternalStore } from 'react';
import type { EditsController } from './controller';
import { Overlay } from './components/Overlay';
import { Panel } from './components/Panel';
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
      if (!current?.isConnected) onRequestClose();
      return null;
    });
  }, [onRequestClose]);

  useElementPicker(host, true, { onHover, onSelect, onEscape });

  const activeSelected = selected?.isConnected ? selected : null;

  return (
    <>
      <Overlay hovered={hovered?.isConnected ? hovered : null} selected={activeSelected} />
      <Panel
        controller={controller}
        selected={activeSelected}
        onSelect={setSelected}
        onDeselect={() => setSelected(null)}
        onClose={onRequestClose}
      />
    </>
  );
}
