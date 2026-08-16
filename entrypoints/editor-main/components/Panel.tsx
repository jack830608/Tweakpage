import { useEffect, useRef, useState, useSyncExternalStore, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import {
  clampWidth,
  DEFAULT_PREFS,
  getPanelPrefs,
  getSavedPanelPosition,
  savePanelPosition,
  savePanelPrefs,
  type PanelPrefs,
  type ThemeChoice,
} from '../panel-position';
import type { Position } from '../hooks/useDraggable';
import type { EditsController } from '../controller';
import type { ToastContent } from './Toast';
import { useDraggable } from '../hooks/useDraggable';
import { t } from '../../../lib/i18n';
import { ShareRow } from './ShareRow';
import { VariantsRow } from './VariantsRow';
import { ChangesTab } from './ChangesTab';
import { CollapsibleSection } from './CollapsibleSection';
import { ModeSwitch } from './ModeSwitch';
import { GripIcon, HandIcon, MinusIcon, PencilIcon, RedoIcon, UndoIcon } from './icons';
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

type View = 'edit' | 'changes';
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
    <aside
      className="pgve-panel"
      ref={panelRef}
      data-theme={prefs.theme === 'system' ? undefined : prefs.theme}
      style={{ ...style, width: prefs.width }}
    >
      <span
        className="pgve-resize"
        role="separator"
        aria-label={t('aria_resize')}
        data-testid="resize-panel"
        onPointerDown={onResize}
      />
      <header className="pgve-header" {...handleProps}>
        <strong><GripIcon /> Tweakpage</strong>
        <span className="pgve-header-buttons">
          <span className="pgve-viewport" data-testid="viewport-width" title={t('tip_viewport')}>
            {viewport}px
          </span>
          <button
            type="button"
            onClick={() => controller.undo()}
            disabled={!canUndo}
            aria-label={t('aria_undo')} data-testid="undo"
            title={t('tip_undo')}
          >
            <UndoIcon />
          </button>
          <button
            type="button"
            onClick={() => controller.redo()}
            disabled={!canRedo}
            aria-label={t('aria_redo')} data-testid="redo"
            title={t('tip_redo')}
          >
            <RedoIcon />
          </button>
          <select
            className="pgve-theme"
            aria-label={t('aria_theme')}
            data-testid="panel-theme"
            value={prefs.theme}
            onChange={(e) => updatePrefs({ ...prefs, theme: e.target.value as ThemeChoice })}
          >
            <option value="system">{t('theme_system')}</option>
            <option value="light">{t('theme_light')}</option>
            <option value="dark">{t('theme_dark')}</option>
          </select>
          <span className="pgve-header-divider" aria-hidden="true" />
          <button type="button" onClick={props.onMinimize} aria-label={t('aria_minimize')} data-testid="minimize" title={t('tip_minimize')}><MinusIcon /></button>
          <button type="button" onClick={onClose} aria-label={t('aria_close')} data-testid="close" title={t('tip_close')}>✕</button>
        </span>
      </header>
      {props.stale ? (
        <div className="pgve-stale" role="alert">
          <p>{STALE_NOTE}</p>
          <button type="button" aria-label={t('aria_reload_page')} data-testid="reload-page" onClick={() => location.reload()}>
            {STALE_RELOAD}
          </button>
        </div>
      ) : (
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
        </label>
      )}
      <VariantsRow controller={controller} />
      <ShareRow controller={controller} onToast={props.onToast} onSnapshot={props.onSnapshot} />
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
      {view === 'changes' ? (
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
            {t('footer_changes', [count])}
            {count > 0 && (
              <span className="pgve-saved" data-testid="save-state">
                {saveState.state === 'failed'
                  ? t('toast_save_failed')
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
