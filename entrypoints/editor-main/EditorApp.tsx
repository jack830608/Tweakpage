import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { browser } from 'wxt/browser';
import type { EditsController } from './controller';
import { Overlay } from './components/Overlay';
import { Panel, type InteractionMode } from './components/Panel';
import { StatusBadge } from './components/StatusBadge';
import { Toast, type ToastContent } from './components/Toast';
import { useElementPicker } from './hooks/useElementPicker';
import { captureBeforeAfter } from './snapshot';
import { useUndoRedoShortcuts } from './hooks/useUndoRedoShortcuts';

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
  const [toast, setToast] = useState<ToastContent | null>(null);

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

  const onSnapshot = useCallback(() => {
    captureBeforeAfter(controller, host, document).then(
      () => setToast({ message: 'Saved before & after snapshots' }),
      () => setToast({ message: 'Snapshot failed' }),
    );
  }, [controller, host]);

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
  useUndoRedoShortcuts(host, controller);

  const activeSelected = selected?.isConnected ? selected : null;

  return (
    <>
      <Overlay
        hovered={mode === 'edit' && hovered?.isConnected ? hovered : null}
        selected={mode === 'edit' ? activeSelected : null}
      />
      <StatusBadge
        previewing={previewing}
        browsing={mode === 'browse'}
        onExitPreview={() => controller.setPreviewOriginal(false)}
        onExitBrowse={() => setMode('edit')}
      />
      {toast && <Toast {...toast} onDismiss={() => setToast(null)} />}
      <Panel
        controller={controller}
        selected={activeSelected}
        mode={mode}
        onModeChange={onModeChange}
        showOnboarding={showOnboarding}
        onDismissOnboarding={dismissOnboarding}
        onSelect={setSelected}
        onHighlight={setHovered}
        onToast={setToast}
        onSnapshot={onSnapshot}
        onClose={onRequestClose}
      />
    </>
  );
}
