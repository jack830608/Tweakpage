import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { browser } from 'wxt/browser';
import type { EditsController } from './controller';
import { Overlay } from './components/Overlay';
import { Panel, type InteractionMode } from './components/Panel';
import { StatusBadge } from './components/StatusBadge';
import { useElementPicker } from './hooks/useElementPicker';

const ONBOARDED_KEY = 'tweakpage:onboarded';

export interface EditorAppProps {
  controller: EditsController;
  host: HTMLElement;
  onRequestClose: () => void;
}

export function EditorApp({ controller, host, onRequestClose }: EditorAppProps) {
  useSyncExternalStore(controller.subscribe, controller.getPage);
  const previewing = useSyncExternalStore(controller.subscribe, controller.isPreviewingOriginal);
  const [hovered, setHovered] = useState<Element | null>(null);
  const [selected, setSelected] = useState<Element | null>(null);
  const [mode, setMode] = useState<InteractionMode>('edit');
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    browser.storage.local
      .get(ONBOARDED_KEY)
      .then((result) => {
        if (!result[ONBOARDED_KEY]) setShowOnboarding(true);
      })
      .catch(() => setShowOnboarding(true));
  }, []);

  const dismissOnboarding = useCallback(() => {
    setShowOnboarding(false);
    browser.storage.local.set({ [ONBOARDED_KEY]: true }).catch(() => {});
  }, []);

  const onModeChange = useCallback((next: InteractionMode) => {
    setMode(next);
    if (next === 'browse') setHovered(null);
  }, []);

  const onHover = useCallback((el: Element | null) => setHovered(el), []);
  const onSelect = useCallback((el: Element) => {
    setSelected(el);
    setHovered(null);
  }, []);
  const onEscape = useCallback(() => {
    if (mode === 'browse') {
      setMode('edit');
      return;
    }
    setSelected((current) => {
      if (!current?.isConnected) onRequestClose();
      return null;
    });
  }, [mode, onRequestClose]);

  useElementPicker(host, mode === 'edit', { onHover, onSelect, onEscape });

  const activeSelected = selected?.isConnected ? selected : null;

  return (
    <>
      <Overlay hovered={hovered?.isConnected ? hovered : null} selected={activeSelected} />
      <StatusBadge
        previewing={previewing}
        browsing={mode === 'browse'}
        onExitPreview={() => controller.setPreviewOriginal(false)}
        onExitBrowse={() => setMode('edit')}
      />
      <Panel
        controller={controller}
        selected={activeSelected}
        mode={mode}
        onModeChange={onModeChange}
        showOnboarding={showOnboarding}
        onDismissOnboarding={dismissOnboarding}
        onSelect={setSelected}
        onDeselect={() => setSelected(null)}
        onClose={onRequestClose}
      />
    </>
  );
}
