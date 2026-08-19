import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { browser } from 'wxt/browser';
import type { EditsController } from './controller';
import { Overlay } from './components/Overlay';
import { Panel, type InteractionMode } from './components/Panel';
import { StatusBadge } from './components/StatusBadge';
import { Toast, type ToastContent } from './components/Toast';
import { eventTargetElement, useElementPicker } from './hooks/useElementPicker';
import { getExclusions, watchExclusions } from '../../lib/exclusions';
import { useKeyboardPicker } from './hooks/useKeyboardPicker';
import { useExtensionAlive } from './hooks/useExtensionAlive';
import { captureBeforeAfter } from './snapshot';
import { parseImport } from '../../lib/edits/import';
import { shareRefFrom } from '../../lib/share/link';
import { revealElement } from './reveal';
import { canEditInline, startInlineEdit, type InlineEditSession } from './inline-edit';
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
  const [refusedBy, setRefusedBy] = useState<string | null>(null);
  const [exclusions, setExclusions] = useState<string[]>([]);
  const [selected, setSelected] = useState<Element | null>(null);
  // The live inline-edit session, if any. A ref, not state: focusout and dblclick race
  // each other, and the session's identity must be checked synchronously inside them.
  const inlineSession = useRef<InlineEditSession | null>(null);
  const [editingEl, setEditingEl] = useState<Element | null>(null);
  const [mode, setMode] = useState<InteractionMode>('edit');
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [showMarks, setShowMarks] = useState(true);
  const [toast, setToast] = useState<ToastContent | null>(null);
  const alive = useExtensionAlive();
  const enabledCount = controller.getPage().records.filter((r) => r.enabled).length;

  useEffect(() => {
    document.dispatchEvent(
      new CustomEvent('tweakpage:ui', {
        detail: { state: minimized ? 'minimized' : 'open', shared: sharedPreview, count: enabledCount },
      }),
    );
  }, [minimized, sharedPreview, enabledCount]);

  useEffect(() => {
    const onOpen = () => setMinimized(false);
    document.addEventListener('tweakpage:open', onOpen);
    return () => document.removeEventListener('tweakpage:open', onOpen);
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
      .sendMessage({ type: 'tweakpage:share-get', ref })
      .then((result: unknown) => {
        const transfer = result as { ok?: boolean; body?: string } | null;
        if (!transfer?.ok || typeof transfer.body !== 'string') {
          setToast({ message: t('shared_missing'), kind: 'error' });
          return;
        }
        // Still validated like any imported file — a link is not a reason to trust what
        // it points at.
        const parsed = parseImport(transfer.body);
        if (!parsed.ok || parsed.page.records.length === 0) {
          setToast({ message: t('shared_missing'), kind: 'error' });
          return;
        }
        // Shown, not saved: whoever opens the link is looking at someone else's proposal,
        // and it stays out of their own copy of the page until they say to keep it.
        controller.previewShared(parsed.page.records);
        setToast({ message: plural(parsed.page.records.length, 'toast_shared_preview_one', 'toast_shared_preview') });
      })
      .catch(() => setToast({ message: t('shared_missing'), kind: 'error' }));
  }, [controller]);

  useEffect(() => {
    const onNavigated = (e: Event) => {
      const url = (e as CustomEvent<{ url?: string }>).detail?.url ?? location.href;
      setSelected(null);
      setHovered(null);
      void controller.navigate(url);
    };
    document.addEventListener('tweakpage:navigated', onNavigated);
    return () => document.removeEventListener('tweakpage:navigated', onNavigated);
  }, [controller]);

  useEffect(() => {
    const onSaveFailed = () => setToast({ message: t('toast_save_failed'), kind: 'error' });
    document.addEventListener('tweakpage:save-failed', onSaveFailed);
    return () => document.removeEventListener('tweakpage:save-failed', onSaveFailed);
  }, []);

  const dismissOnboarding = useCallback(() => {
    setShowOnboarding(false);
    safeStorageSet({ [ONBOARDED_KEY]: true });
  }, []);

  const onSnapshot = useCallback(
    () =>
      captureBeforeAfter(controller, host, document).then(
        () => {
          setToast({ message: t('toast_snapshots'), kind: 'success' });
          return true;
        },
        () => {
          setToast({ message: t('toast_snapshot_failed'), kind: 'error' });
          return false;
        },
      ),
    [controller, host],
  );

  const onModeChange = useCallback((next: InteractionMode) => {
    setMode(next);
    if (next === 'browse') setHovered(null);
  }, []);

  const finishInlineEdit = useCallback(() => {
    const session = inlineSession.current;
    if (!session) return;
    inlineSession.current = null;
    setEditingEl(null);
    session.finish();
  }, []);

  // Double-click on text starts editing it where it lives; blur, Esc or clicking away
  // finishes. The panel's text boxes stay — this is the fast path, not a replacement.
  useEffect(() => {
    if (mode !== 'edit' || !alive) return;
    const onDblClick = (e: MouseEvent) => {
      const target = eventTargetElement(e, host);
      if (!target || !canEditInline(target)) return;
      if (inlineSession.current?.element === target) return;
      finishInlineEdit();
      e.preventDefault();
      e.stopPropagation();
      setSelected(target);
      setHovered(null);
      inlineSession.current = startInlineEdit(target, controller, () =>
        setToast({ message: t('toast_inline_unrecorded'), kind: 'error' }),
      );
      setEditingEl(target);
    };
    const onFocusOut = (e: FocusEvent) => {
      if (inlineSession.current && e.target === inlineSession.current.element) finishInlineEdit();
    };
    document.addEventListener('dblclick', onDblClick, true);
    document.addEventListener('focusout', onFocusOut, true);
    return () => {
      document.removeEventListener('dblclick', onDblClick, true);
      document.removeEventListener('focusout', onFocusOut, true);
      finishInlineEdit();
    };
  }, [mode, alive, host, controller, finishInlineEdit]);

  // Read once and then followed by both pickers; Settings is a different view of the
  // same session, so a rule added there has to arrive without a reload.
  useEffect(() => {
    void getExclusions().then(setExclusions);
    return watchExclusions(setExclusions);
  }, []);

  const onHover = useCallback(
    (el: Element | null, refused?: string | null) => {
      // While typing, outlining whatever the mouse drifts over is just noise.
      if (inlineSession.current && el && inlineSession.current.element.contains(el)) return;
      setHovered(el);
      setRefusedBy(refused ?? null);
    },
    [],
  );
  const onSelect = useCallback((el: Element) => {
    // A click inside the element being edited is the caret moving, not a selection.
    if (inlineSession.current?.element.contains(el)) return;
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

  useElementPicker(host, mode === 'edit' && alive, { onHover, onSelect, onEscape }, exclusions);
  useUndoRedoShortcuts(host, controller);
  useKeyboardPicker(host, { enabled: mode === 'edit' && alive, selected, onSelect, exclusions });

  const activeSelected = selected?.isConnected ? selected : null;

  return (
    <>
      <Overlay
        hovered={mode === 'edit' && alive && hovered?.isConnected ? hovered : null}
        refusedBy={refusedBy}
        selected={mode === 'edit' && alive ? activeSelected : null}
        editing={editingEl?.isConnected ? editingEl : null}
        edited={mode === 'edit' && showMarks ? Array.from(document.querySelectorAll('[data-tweakpage]')) : []}
        canMove={(el, direction) => controller.canMove(el, direction)}
        onMove={(el, direction) => {
          controller.moveElement(el, direction);
          // Follow the element: a step past a tall sibling leaves the user staring at
          // the hole it used to fill. Already-visible elements are left alone.
          revealElement(el);
        }}
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
