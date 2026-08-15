import { useRef, useState, useSyncExternalStore } from 'react';
import type { EditsController } from '../controller';
import { useDraggable } from '../hooks/useDraggable';
import { Breadcrumb } from './Breadcrumb';
import { ChangesTab } from './ChangesTab';
import { BackgroundSection } from './sections/BackgroundSection';
import { ImageSection } from './sections/ImageSection';
import { SizeSection } from './sections/SizeSection';
import { SpacingSection } from './sections/SpacingSection';
import { TextSection } from './sections/TextSection';
import { TypographySection } from './sections/TypographySection';

type Tab = 'edit' | 'changes';

export interface PanelProps {
  controller: EditsController;
  selected: Element | null;
  onSelect: (el: Element) => void;
  onClose: () => void;
}

export function Panel({ controller, selected, onSelect, onClose }: PanelProps) {
  const [tab, setTab] = useState<Tab>('edit');
  const count = useSyncExternalStore(controller.subscribe, controller.getPage).records.length;
  const panelRef = useRef<HTMLElement>(null);
  const { style, handleProps } = useDraggable(panelRef);
  return (
    <aside className="pgve-panel" ref={panelRef} style={style}>
      <header className="pgve-header" {...handleProps}>
        <strong>Tweakpage</strong>
        <button type="button" onClick={onClose} aria-label="Close">✕</button>
      </header>
      <nav className="pgve-tabs">
        <button
          type="button"
          className={tab === 'edit' ? 'pgve-tab-active' : ''}
          onClick={() => setTab('edit')}
        >
          Edit
        </button>
        <button
          type="button"
          className={tab === 'changes' ? 'pgve-tab-active' : ''}
          onClick={() => setTab('changes')}
        >
          {`Changes (${count})`}
        </button>
      </nav>
      {tab === 'edit' ? (
        <EditTab controller={controller} selected={selected} onSelect={onSelect} />
      ) : (
        <ChangesTab controller={controller} />
      )}
    </aside>
  );
}

function EditTab({ controller, selected, onSelect }: Omit<PanelProps, 'onClose'>) {
  if (!selected) {
    return <p className="pgve-empty">Select an element on the page to edit it.</p>;
  }
  if (selected.tagName === 'IFRAME') {
    return <p className="pgve-empty">Editing inside iframes isn't supported.</p>;
  }
  return (
    <div className="pgve-sections">
      <Breadcrumb element={selected} onSelect={onSelect} />
      <TextSection element={selected} controller={controller} />
      <TypographySection element={selected} controller={controller} />
      <BackgroundSection element={selected} controller={controller} />
      <ImageSection element={selected} controller={controller} />
      <SizeSection element={selected} controller={controller} />
      <SpacingSection element={selected} controller={controller} />
    </div>
  );
}
