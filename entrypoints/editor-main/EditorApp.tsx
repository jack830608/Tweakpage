import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { browser } from 'wxt/browser';
import type { EditsController } from './controller';
import { Overlay } from './components/Overlay';
import { Panel, type InteractionMode } from './components/Panel';
import { StatusBadge } from './components/StatusBadge';
import { Toast, type ToastContent } from './components/Toast';
import { useElementPicker } from './hooks/useElementPicker';
import { useKeyboardPicker } from './hooks/useKeyboardPicker';
import { useExtensionAlive } from './hooks/useExtensionAlive';
import { captureBeforeAfter } from './snapshot';
import { parseImport } from '../../lib/edits/import';
import { shareRefFrom } from '../../lib/share/link';
import { safeStorageSet } from '../../lib/extension-context';
import { plural, t } from '../../lib/i18n';
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
  const sharedPreview = useSyncExternalStore(controller.subscribe, controller.isPreviewingShared);
  const [hovered, setHovered] = useState<Element | null>(null);
  const [selected, setSelected] = useState<Element | null>(null);
  const [mode, setMode] = useState<InteractionMode>('edit');
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [showMarks, setShowMarks] = useState(true);
  const [toast, setToast] = useState<ToastContent | null>(null);
  const alive = useExtensionAlive();
  const enabledCount = controller.getPage().records.filter((r) => r.enabled).length;

  useEffect(() => {
    document.dispatchEvent(
      new CustomEvent('pg-editor:ui', {
        detail: { state: minimized ? 'minimized' : 'open', shared: sharedPreview, count: enabledCount },
      }),
    );
  }, [minimized, sharedPreview, enabledCount]);

  useEffect(() => {
    const onOpen = () => setMinimized(false);
    document.addEventListener('pg-editor:open', onOpen);
    return () => document.removeEventListener('pg-editor:open', onOpen);
  }, []);

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

  useEffect(() => {
    const ref = shareRefFrom(location.href);
    if (!ref) return;
    void browser.runtime
      .sendMessage({ type: 'pg:share-get', ref })
      .then((result: unknown) => {
        const transfer = result as { ok?: boolean; body?: string } | null;
        if (!transfer?.ok || typeof transfer.body !== 'string') {
          setToast({ message: t('shared_missing') });
          return;
        }
        // Still validated like any imported file — a link is not a reason to trust what
        // it points at.
        const parsed = parseImport(transfer.body);
        if (!parsed.ok || parsed.page.records.length === 0) {
          setToast({ message: t('shared_missing') });
          return;
        }
        // Shown, not saved: whoever opens the link is looking at someone else's proposal,
        // and it stays out of their own copy of the page until they say to keep it.
        controller.previewShared(parsed.page.records);
        setToast({ message: plural(parsed.page.records.length, 'toast_shared_preview_one', 'toast_shared_preview') });
      })
      .catch(() => setToast({ message: t('shared_missing') }));
  }, [controller]);

  useEffect(() => {
    const onNavigated = (e: Event) => {
      const url = (e as CustomEvent<{ url?: string }>).detail?.url ?? location.href;
      setSelected(null);
      setHovered(null);
      void controller.navigate(url);
    };
    document.addEventListener('pg-editor:navigated', onNavigated);
    return () => document.removeEventListener('pg-editor:navigated', onNavigated);
  }, [controller]);

  useEffect(() => {
    const onSaveFailed = () => setToast({ message: t('toast_save_failed') });
    document.addEventListener('pg-editor:save-failed', onSaveFailed);
    return () => document.removeEventListener('pg-editor:save-failed', onSaveFailed);
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
  useKeyboardPicker(host, { enabled: mode === 'edit' && alive, selected, onSelect });

  const activeSelected = selected?.isConnected ? selected : null;

  return (
    <>
      <Overlay
        hovered={mode === 'edit' && alive && hovered?.isConnected ? hovered : null}
        selected={mode === 'edit' && alive ? activeSelected : null}
        edited={mode === 'edit' && showMarks ? Array.from(document.querySelectorAll('[data-tweakpage]')) : []}
        canMove={(el, direction) => controller.canMove(el, direction)}
        onMove={(el, direction) => controller.moveElement(el, direction)}
      />
      <StatusBadge
        previewing={previewing}
        browsing={mode === 'browse'}
        onExitPreview={() => controller.setPreviewOriginal(false)}
        onExitBrowse={() => setMode('edit')}
      />
      {toast && <Toast {...toast} onDismiss={() => setToast(null)} />}
      {/* Minimized shows no UI of its own: the applier's corner chip is the way back,
          so the count lives in one place with one look, open editor or not. */}
      {!minimized && (
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
        showMarks={showMarks}
        onToggleMarks={setShowMarks}
        onMinimize={() => setMinimized(true)}
        onClose={onRequestClose}
      />
      )}
    </>
  );
}
