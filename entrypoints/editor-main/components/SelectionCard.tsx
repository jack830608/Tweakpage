import { useSyncExternalStore } from 'react';
import { buildElementLabel } from '../../../lib/selector/generate';
import type { EditsController } from '../controller';
import { Breadcrumb } from './Breadcrumb';

interface SelectionCardProps {
  element: Element;
  controller: EditsController;
  onSelect: (el: Element) => void;
}

export function SelectionCard({ element, controller, onSelect }: SelectionCardProps) {
  useSyncExternalStore(controller.subscribe, controller.getPage);
  const hiddenRecord = controller.recordFor(element, 'display');
  const hidden = hiddenRecord?.newValue === 'none';

  const onToggleHide = () => {
    if (hidden && hiddenRecord) {
      controller.deleteRecord(hiddenRecord.id);
      return;
    }
    controller.recordEdit(element, 'style', 'display', getComputedStyle(element).display, 'none');
  };

  return (
    <div className="pgve-selection-card">
      <div className="pgve-selection-head">
        <div className="pgve-selection-label">{buildElementLabel(element)}</div>
        <button
          type="button"
          aria-label={hidden ? 'Unhide element' : 'Hide element'}
          title={hidden ? 'Show the element again' : 'Hide the selected element'}
          onClick={onToggleHide}
        >
          {hidden ? '👁 Unhide' : '🙈 Hide'}
        </button>
      </div>
      <Breadcrumb element={element} onSelect={onSelect} />
    </div>
  );
}
