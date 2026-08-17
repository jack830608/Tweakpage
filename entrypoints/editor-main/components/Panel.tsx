import { useEffect, useRef, useState, useSyncExternalStore, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import {
  clampWidth,
  DEFAULT_PREFS,
  MAX_WIDTH,
  MIN_WIDTH,
  getPanelPrefs,
  getSavedPanelPosition,
  savePanelPosition,
  savePanelPrefs,
  type PanelPrefs,
} from '../panel-position';
import type { Position } from '../hooks/useDraggable';
import type { EditsController } from '../controller';
import type { ToastContent } from './Toast';
import { useDraggable } from '../hooks/useDraggable';
import { plural, t } from '../../../lib/i18n';
import { ShareRow } from './ShareRow';
import { VariantsRow } from './VariantsRow';
import { ChangesTab } from './ChangesTab';
import { CollapsibleSection } from './CollapsibleSection';
import { ModeSwitch } from './ModeSwitch';
import { SettingsView } from './SettingsView';
import { CloseIcon, GearIcon, GripIcon, HandIcon, MinusIcon, PencilIcon, RedoIcon, UndoIcon } from './icons';
import { OnboardingCard } from './OnboardingCard';
import { SelectionCard } from './SelectionCard';
import { AppearanceSection } from './sections/AppearanceSection';
import { BackgroundSection } from './sections/BackgroundSection';
import { ImageSection } from './sections/ImageSection';
import { isLink, LinkSection } from './sections/LinkSection';
import { LayoutSection } from './sections/LayoutSection';
import { SizeSection } from './sections/SizeSection';
import { SpacingSection } from './sections/SpacingSection';
import { TextSection, hasDirectText } from './sections/TextSection';
import { TypographySection } from './sections/TypographySection';

type View = 'edit' | 'changes' | 'settings';
export type InteractionMode = 'edit' | 'browse';

export interface PanelProps {
  controller: EditsController;
  selected: Element | null;
  stale?: boolean;
  mode: InteractionMode;
  onModeChange: (mode: InteractionMode) => void;
  showOnboarding: boolean;
  onDismissOnboarding: () => void;
  onSelect: (el: Element) => void;
  onHighlight: (el: Element | null) => void;
  onToast: (toast: ToastContent) => void;
  onSnapshot: () => void;
  showMarks?: boolean;
  onToggleMarks?: (on: boolean) => void;
  onMinimize: () => void;
  onClose: () => void;
}

// Resolved at module load, while the extension context is still alive —
// browser.i18n may already be unreachable by the time this notice renders.
const STALE_NOTE = t('stale_note');
const STALE_RELOAD = t('stale_reload');

const INTERACTION_OPTIONS = [
  { value: 'edit', label: <><PencilIcon /> {t('mode_edit')}</>, ariaLabel: t('mode_edit') },
  { value: 'browse', label: <><HandIcon /> {t('mode_browse')}</>, ariaLabel: t('mode_browse') },
] as const;

const COMPARE_OPTIONS = [
  { value: 'edited', label: t('compare_edited'), ariaLabel: t('compare_edited') },
  { value: 'original', label: t('compare_original'), ariaLabel: t('compare_original') },
] as const;

const SECTION_DEFS: Array<{
  id: string;
  applies?: (element: Element) => boolean;
  render: (element: Element, controller: EditsController) => ReactNode;
}> = [
  { id: 'text', applies: hasDirectText, render: (el, c) => <TextSection element={el} controller={c} /> },
  { id: 'typography', render: (el, c) => <TypographySection element={el} controller={c} /> },
  { id: 'background', render: (el, c) => <BackgroundSection element={el} controller={c} /> },
  { id: 'image', applies: (el) => el.tagName === 'IMG', render: (el, c) => <ImageSection element={el} controller={c} /> },
  { id: 'link', applies: isLink, render: (el, c) => <LinkSection element={el} controller={c} /> },
  { id: 'appearance', render: (el, c) => <AppearanceSection element={el} controller={c} /> },
  { id: 'size', render: (el, c) => <SizeSection element={el} controller={c} /> },
  { id: 'layout', render: (el, c) => <LayoutSection element={el} controller={c} /> },
  { id: 'spacing', render: (el, c) => <SpacingSection element={el} controller={c} /> },
];

export function Panel(props: PanelProps) {
  const { controller, mode, onModeChange, onClose } = props;
  const [view, setView] = useState<View>('edit');
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(
    DEFAULT_PREFS.openSections,
  );
  useEffect(() => {
    if (props.selected?.tagName === 'IMG') {
      setOpenSections((open) => (open.image ? open : { ...open, image: true }));
    }
  }, [props.selected]);
  const records = useSyncExternalStore(controller.subscribe, controller.getPage).records;
  const count = records.length;
  const stale = records.filter((r) => controller.getStatus(r.id) === 'not-found').length;
  // Edits are recorded with the width they were made at, so show which width that is.
  const [viewport, setViewport] = useState(() => window.innerWidth);
  useEffect(() => {
    const onResize = () => setViewport(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  const saveState = controller.getSaveState();
  const canUndo = controller.canUndo();
  const canRedo = controller.canRedo();
  const previewing = useSyncExternalStore(controller.subscribe, controller.isPreviewingOriginal);
  const sharedPreview = useSyncExternalStore(controller.subscribe, controller.isPreviewingShared);
  const panelRef = useRef<HTMLElement>(null);
  const [restoredPosition, setRestoredPosition] = useState<Position | null>(null);
  useEffect(() => {
    void getSavedPanelPosition().then((pos) => {
      if (pos) setRestoredPosition(pos);
    });
  }, []);
  const { style, handleProps } = useDraggable(panelRef, {
    restoredPosition,
    onDragEnd: savePanelPosition,
  });
  const [prefs, setPrefs] = useState<PanelPrefs>(DEFAULT_PREFS);
  useEffect(() => {
    void getPanelPrefs().then((saved) => {
      setPrefs(saved);
      setOpenSections(saved.openSections);
    });
  }, []);
  // The attribute goes on the shadow host: tokens are declared there, so an explicit
  // choice has to be able to beat the media query on the same element, in both directions.
  useEffect(() => {
    const root = panelRef.current?.getRootNode();
    const hostEl = root instanceof ShadowRoot ? (root.host as HTMLElement) : null;
    if (!hostEl) return;
    if (prefs.theme === 'system') hostEl.removeAttribute('data-theme');
    else hostEl.setAttribute('data-theme', prefs.theme);
  }, [prefs.theme]);

  const updatePrefs = (next: PanelPrefs) => {
    setPrefs(next);
    savePanelPrefs(next);
  };
  const onResize = (e: ReactPointerEvent<HTMLElement>) => {
    const startX = e.clientX;
    const startWidth = panelRef.current?.getBoundingClientRect().width ?? prefs.width;
    const move = (ev: PointerEvent) => {
      // The panel is anchored on the right, so dragging left makes it wider.
      setPrefs((p) => ({ ...p, width: clampWidth(startWidth + (startX - ev.clientX)) }));
    };
    const up = () => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
      setPrefs((p) => {
        savePanelPrefs(p);
        return p;
      });
    };
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
  };

  return (
    <aside className="pgve-panel" ref={panelRef} style={{ ...style, width: prefs.width }}>
      {/* The separator pattern: focusable, announcing its value, driven by arrows —
          resizing existed only for pointers before (review 2026-08-17, finding 5).
          The panel is anchored right, so ArrowLeft moves its left edge left: wider. */}
      <span
        className="pgve-resize"
        role="separator"
        tabIndex={0}
        aria-label={t('aria_resize')}
        aria-orientation="vertical"
        aria-valuemin={MIN_WIDTH}
        aria-valuemax={MAX_WIDTH}
        aria-valuenow={prefs.width}
        data-testid="resize-panel"
        onPointerDown={onResize}
        onKeyDown={(e) => {
          const step = e.shiftKey ? 64 : 16;
          const next =
            e.key === 'ArrowLeft' ? prefs.width + step
            : e.key === 'ArrowRight' ? prefs.width - step
            : e.key === 'Home' ? MAX_WIDTH
            : e.key === 'End' ? MIN_WIDTH
            : null;
          if (next === null) return;
          e.preventDefault();
          updatePrefs({ ...prefs, width: clampWidth(next) });
        }}
      />
      <header className="pgve-header" {...handleProps}>
        <strong><GripIcon /> Tweakpage</strong>
        <span className="pgve-header-buttons">
          <button
            type="button"
            onClick={() => controller.undo()}
            disabled={!canUndo}
            aria-label={t('aria_undo')}
            data-testid="undo"
            title={t('tip_undo')}
          >
            <UndoIcon />
          </button>
          <button
            type="button"
            onClick={() => controller.redo()}
            disabled={!canRedo}
            aria-label={t('aria_redo')}
            data-testid="redo"
            title={t('tip_redo')}
          >
            <RedoIcon />
          </button>
          <button
            type="button"
            onClick={() => setView((current) => (current === 'settings' ? 'edit' : 'settings'))}
            aria-label={t('aria_settings')}
            aria-pressed={view === 'settings'}
            data-testid="open-settings"
            title={t('settings_title')}
          >
            <GearIcon />
          </button>
          <span className="pgve-header-divider" aria-hidden="true" />
          <button type="button" onClick={props.onMinimize} aria-label={t('aria_minimize')} data-testid="minimize" title={t('tip_minimize')}><MinusIcon /></button>
          <button type="button" onClick={onClose} aria-label={t('aria_close')} data-testid="close" title={t('tip_close')}>
            <CloseIcon />
          </button>
        </span>
      </header>
      {sharedPreview && (
        <div className="pgve-shared" role="status" data-testid="shared-preview">
          <div>
            <strong>{t('shared_preview_title')}</strong>
            <p>{t('shared_preview_body')}</p>
          </div>
          <button
            type="button"
            aria-label={t('aria_keep_shared')}
            data-testid="keep-shared"
            onClick={() => {
              controller.keepShared();
              props.onToast({ message: t('toast_shared_kept') });
            }}
          >
            {t('shared_preview_keep')}
          </button>
        </div>
      )}
      {props.stale ? (
        <div className="pgve-stale" role="alert">
          <p>{STALE_NOTE}</p>
          <button type="button" aria-label={t('aria_reload_page')} data-testid="reload-page" onClick={() => location.reload()}>
            {STALE_RELOAD}
          </button>
        </div>
      ) : (
        <>
      {/* Everything here acts on the page being edited, so settings — which act on the
          extension — stand on their own rather than under a row of unrelated controls. */}
      {view !== 'settings' && (
        <>
      <ModeSwitch
        ariaLabel={t('aria_interaction_mode')}
        options={INTERACTION_OPTIONS}
        value={mode}
        onChange={onModeChange}
      />
      <ModeSwitch
        ariaLabel={t('aria_compare')}
        options={COMPARE_OPTIONS}
        value={previewing ? 'original' : 'edited'}
        onChange={(value) => controller.setPreviewOriginal(value === 'original')}
      />
      {view === 'edit' && count > 0 && props.onToggleMarks && (
        <label className="pgve-marks-toggle">
          <input
            type="checkbox"
            aria-label={t('aria_show_marks')}
            data-testid="show-marks"
            checked={props.showMarks ?? true}
            onChange={(e) => props.onToggleMarks?.(e.target.checked)}
          />
          {t('show_marks')}
          <span className="pgve-viewport" data-testid="viewport-width" title={t('tip_viewport')}>
            {viewport}px
          </span>
        </label>
      )}
      <VariantsRow controller={controller} />
      <ShareRow controller={controller} onToast={props.onToast} onSnapshot={props.onSnapshot} />
        </>
      )}
      {stale > 0 && view === 'edit' && (
        <button
          type="button"
          className="pgve-stale-edits"
          aria-label={t('aria_review_unmatched')} data-testid="review-unmatched-edits"
          onClick={() => setView('changes')}
        >
          {t('stale_edits', [stale, count])}
        </button>
      )}
      {view === 'settings' ? (
        <div>
          <button
            type="button"
            className="pgve-back-row"
            aria-label={t('aria_back_to_editing')} data-testid="back-from-settings"
            onClick={() => setView('edit')}
          >
            {t('back_row')}
          </button>
          <SettingsView prefs={prefs} onPrefs={updatePrefs} onToast={props.onToast} />
        </div>
      ) : view === 'changes' ? (
        <div>
          <button
            type="button"
            className="pgve-back-row"
            aria-label={t('aria_back_to_editing')} data-testid="back-to-editing"
            onClick={() => setView('edit')}
          >
            {t('back_row')}
          </button>
          <ChangesTab
            controller={controller}
            onToast={props.onToast}
            onHighlight={props.onHighlight}
            onSelectRecord={(el) => {
              props.onHighlight(null);
              props.onSelect(el);
              setView('edit');
            }}
          />
        </div>
      ) : (
        <>
          <EditView
            controller={controller}
            selected={props.selected}
            previewing={previewing}
            showOnboarding={props.showOnboarding}
            onDismissOnboarding={props.onDismissOnboarding}
            onSelect={props.onSelect}
            openSections={openSections}
            onToggleSection={(title) =>
              setOpenSections((open) => {
                const next = { ...open, [title]: !open[title] };
                savePanelPrefs({ ...prefs, openSections: next });
                return next;
              })
            }
          />
          <button
            type="button"
            className={count > 0 ? 'pgve-footer pgve-footer-active' : 'pgve-footer'}
            aria-label={t('aria_review_changes')} data-testid="review-changes"
            onClick={() => setView('changes')}
          >
            {plural(count, 'footer_changes_one', 'footer_changes')}
            {count > 0 && (
              <span className="pgve-saved" data-testid="save-state">
                {saveState.state === 'failed'
                  ? t('toast_save_failed')
                  : saveState.state === 'preview'
                    ? t('not_saved_preview')
                    : saveState.state === 'saving'
                      ? t('saving')
                      : t('saved_just_now')}
              </span>
            )}
          </button>
        </>
      )}
        </>
      )}
    </aside>
  );
}

interface EditViewProps {
  controller: EditsController;
  selected: Element | null;
  previewing: boolean;
  showOnboarding: boolean;
  onDismissOnboarding: () => void;
  onSelect: (el: Element) => void;
  openSections: Record<string, boolean>;
  onToggleSection: (title: string) => void;
}

function EditView({
  controller,
  selected,
  previewing,
  showOnboarding,
  onDismissOnboarding,
  onSelect,
  openSections,
  onToggleSection,
}: EditViewProps) {
  if (showOnboarding) {
    return <OnboardingCard onDismiss={onDismissOnboarding} />;
  }
  if (previewing) {
    return (
      <p className="pgve-preview-note">{t('preview_note')}</p>
    );
  }
  if (!selected) {
    return (
      <div>
        <p className="pgve-empty">{t('empty_select')}</p>
        <p className="pgve-empty">{t('empty_hint')}</p>
      </div>
    );
  }
  if (selected.tagName === 'IFRAME') {
    return <p className="pgve-empty">{t('iframe_note')}</p>;
  }
  const hidden = controller.recordFor(selected, 'display')?.newValue === 'none';
  return (
    <div className="pgve-sections">
      <SelectionCard element={selected} controller={controller} onSelect={onSelect} />
      {hidden ? (
        <p className="pgve-preview-note">{t('hidden_note')}</p>
      ) : (
        SECTION_DEFS.filter(({ applies }) => !applies || applies(selected)).map(({ id, render }) => (
          <CollapsibleSection
            key={id}
            sectionId={id}
            title={t(`sec_${id}`)}
            open={!!openSections[id]}
            onToggle={() => onToggleSection(id)}
          >
            {render(selected, controller)}
          </CollapsibleSection>
        ))
      )}
    </div>
  );
}
