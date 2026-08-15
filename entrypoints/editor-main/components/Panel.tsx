import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import type { EditsController } from '../controller';
import type { ToastContent } from './Toast';
import { useDraggable } from '../hooks/useDraggable';
import { ShareRow } from './ShareRow';
import { ChangesTab } from './ChangesTab';
import { CollapsibleSection } from './CollapsibleSection';
import { ModeSwitch } from './ModeSwitch';
import { GripIcon, HandIcon, PencilIcon } from './icons';
import { OnboardingCard } from './OnboardingCard';
import { SelectionCard } from './SelectionCard';
import { AppearanceSection } from './sections/AppearanceSection';
import { BackgroundSection } from './sections/BackgroundSection';
import { ImageSection } from './sections/ImageSection';
import { SizeSection } from './sections/SizeSection';
import { SpacingSection } from './sections/SpacingSection';
import { TextSection, hasDirectText } from './sections/TextSection';
import { TypographySection } from './sections/TypographySection';

type View = 'edit' | 'changes';
export type InteractionMode = 'edit' | 'browse';

export interface PanelProps {
  controller: EditsController;
  selected: Element | null;
  mode: InteractionMode;
  onModeChange: (mode: InteractionMode) => void;
  showOnboarding: boolean;
  onDismissOnboarding: () => void;
  onSelect: (el: Element) => void;
  onHighlight: (el: Element | null) => void;
  onToast: (toast: ToastContent) => void;
  onSnapshot: () => void;
  onClose: () => void;
}

const INTERACTION_OPTIONS = [
  { value: 'edit', label: <><PencilIcon /> Edit</> },
  { value: 'browse', label: <><HandIcon /> Browse</> },
] as const;

const COMPARE_OPTIONS = [
  { value: 'edited', label: 'Edited' },
  { value: 'original', label: 'Original' },
] as const;

const SECTION_DEFS: Array<{
  title: string;
  applies?: (element: Element) => boolean;
  render: (element: Element, controller: EditsController) => ReactNode;
}> = [
  { title: 'Text', applies: hasDirectText, render: (el, c) => <TextSection element={el} controller={c} /> },
  { title: 'Typography', render: (el, c) => <TypographySection element={el} controller={c} /> },
  { title: 'Background', render: (el, c) => <BackgroundSection element={el} controller={c} /> },
  { title: 'Image', applies: (el) => el.tagName === 'IMG', render: (el, c) => <ImageSection element={el} controller={c} /> },
  { title: 'Appearance', render: (el, c) => <AppearanceSection element={el} controller={c} /> },
  { title: 'Size', render: (el, c) => <SizeSection element={el} controller={c} /> },
  { title: 'Spacing', render: (el, c) => <SpacingSection element={el} controller={c} /> },
];

export function Panel(props: PanelProps) {
  const { controller, mode, onModeChange, onClose } = props;
  const [view, setView] = useState<View>('edit');
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    Text: true,
    Typography: true,
  });
  useEffect(() => {
    if (props.selected?.tagName === 'IMG') {
      setOpenSections((open) => (open.Image ? open : { ...open, Image: true }));
    }
  }, [props.selected]);
  const count = useSyncExternalStore(controller.subscribe, controller.getPage).records.length;
  const previewing = useSyncExternalStore(controller.subscribe, controller.isPreviewingOriginal);
  const panelRef = useRef<HTMLElement>(null);
  const { style, handleProps } = useDraggable(panelRef);

  return (
    <aside className="pgve-panel" ref={panelRef} style={style}>
      <header className="pgve-header" {...handleProps}>
        <strong><GripIcon /> Tweakpage</strong>
        <button type="button" onClick={onClose} aria-label="Close">✕</button>
      </header>
      <ModeSwitch
        ariaLabel="Interaction mode"
        options={INTERACTION_OPTIONS}
        value={mode}
        onChange={onModeChange}
      />
      <ModeSwitch
        ariaLabel="Compare"
        options={COMPARE_OPTIONS}
        value={previewing ? 'original' : 'edited'}
        onChange={(value) => controller.setPreviewOriginal(value === 'original')}
      />
      <ShareRow controller={controller} onToast={props.onToast} onSnapshot={props.onSnapshot} />
      {view === 'changes' ? (
        <div>
          <button type="button" className="pgve-back-row" onClick={() => setView('edit')}>
            ‹ Back to editing
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
              setOpenSections((open) => ({ ...open, [title]: !open[title] }))
            }
          />
          <button
            type="button"
            className={count > 0 ? 'pgve-footer pgve-footer-active' : 'pgve-footer'}
            onClick={() => setView('changes')}
          >
            {`${count} changes · Review ›`}
          </button>
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
      <p className="pgve-preview-note">
        Viewing the original page — switch back to Edited to continue editing.
      </p>
    );
  }
  if (!selected) {
    return (
      <div>
        <p className="pgve-empty">Select an element on the page to edit it.</p>
        <p className="pgve-empty">
          Switch to Browse to use the page normally. Drag this panel by its title bar.
        </p>
      </div>
    );
  }
  if (selected.tagName === 'IFRAME') {
    return <p className="pgve-empty">Editing inside iframes isn't supported.</p>;
  }
  const hidden = controller.recordFor(selected, 'display')?.newValue === 'none';
  return (
    <div className="pgve-sections">
      <SelectionCard element={selected} controller={controller} onSelect={onSelect} />
      {hidden ? (
        <p className="pgve-preview-note">Element is hidden — Unhide to edit it.</p>
      ) : (
        SECTION_DEFS.filter(({ applies }) => !applies || applies(selected)).map(({ title, render }) => (
          <CollapsibleSection
            key={title}
            title={title}
            open={!!openSections[title]}
            onToggle={() => onToggleSection(title)}
          >
            {render(selected, controller)}
          </CollapsibleSection>
        ))
      )}
    </div>
  );
}
