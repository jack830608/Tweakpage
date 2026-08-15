import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { browser } from 'wxt/browser';
import type { EditsController } from './controller';
import { Overlay } from './components/Overlay';
import { Panel, type InteractionMode } from './components/Panel';
import { GripIcon } from './components/icons';
import { StatusBadge } from './components/StatusBadge';
import { Toast, type ToastContent } from './components/Toast';
import { useElementPicker } from './hooks/useElementPicker';
import { useExtensionAlive } from './hooks/useExtensionAlive';
import { captureBeforeAfter } from './snapshot';
import { safeStorageSet } from '../../lib/extension-context';
import { t } from '../../lib/i18n';
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
  const [minimized, setMinimized] = useState(false);
  const [toast, setToast] = useState<ToastContent | null>(null);
  const alive = useExtensionAlive();

  useEffect(() => {
    try {
      browser.storage.local
        .get(ONBOARDED_KEY)
        .then((result) => {
          if (!result[ONBOARDED_KEY]) setShowOnboarding(true);
        })
        .catch(() => setShowOnboarding(true));
    } catch {
      // context invalidated — onboarding is pointless in a dead session
    }
  }, []);

  const dismissOnboarding = useCallback(() => {
    setShowOnboarding(false);
    safeStorageSet({ [ONBOARDED_KEY]: true });
  }, []);

  const onSnapshot = useCallback(() => {
    captureBeforeAfter(controller, host, document).then(
      () => setToast({ message: t('toast_snapshots') }),
      () => setToast({ message: t('toast_snapshot_failed') }),
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
    setMinimized(false);
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

  useElementPicker(host, mode === 'edit' && alive, { onHover, onSelect, onEscape });
  useUndoRedoShortcuts(host, controller);

  const activeSelected = selected?.isConnected ? selected : null;

  return (
    <>
      <Overlay
        hovered={mode === 'edit' && alive && hovered?.isConnected ? hovered : null}
        selected={mode === 'edit' && alive ? activeSelected : null}
      />
      <StatusBadge
        previewing={previewing}
        browsing={mode === 'browse'}
        onExitPreview={() => controller.setPreviewOriginal(false)}
        onExitBrowse={() => setMode('edit')}
      />
      {toast && <Toast {...toast} onDismiss={() => setToast(null)} />}
      {minimized ? (
        <button
          type="button"
          className="pgve-pill"
          aria-label="Expand Tweakpage"
          onClick={() => setMinimized(false)}
        >
          <GripIcon /> Tweakpage
          {controller.getPage().records.length > 0 && (
            <span className="pgve-pill-count">{controller.getPage().records.length}</span>
          )}
        </button>
      ) : (
      <Panel
        controller={controller}
        selected={activeSelected}
        stale={!alive}
        mode={mode}
        onModeChange={onModeChange}
        showOnboarding={showOnboarding}
        onDismissOnboarding={dismissOnboarding}
        onSelect={setSelected}
        onHighlight={setHovered}
        onToast={setToast}
        onSnapshot={onSnapshot}
        onMinimize={() => setMinimized(true)}
        onClose={onRequestClose}
      />
      )}
    </>
  );
}
