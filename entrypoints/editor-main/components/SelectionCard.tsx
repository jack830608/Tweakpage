import { buildElementLabel } from '../../../lib/selector/generate';
import type { EditsController } from '../controller';
import { Breadcrumb } from './Breadcrumb';
import type { ToastContent } from './Toast';

interface SelectionCardProps {
  element: Element;
  controller: EditsController;
  onSelect: (el: Element) => void;
  onDeselect: () => void;
  onToast: (toast: ToastContent) => void;
}

export function SelectionCard({ element, controller, onSelect, onDeselect, onToast }: SelectionCardProps) {
  const onHide = () => {
    controller.recordEdit(element, 'style', 'display', getComputedStyle(element).display, 'none');
    const record = controller.recordFor(element, 'display');
    onDeselect();
    onToast({
      message: 'Element hidden',
      actionLabel: 'Undo',
      onAction: () => {
        if (record) controller.deleteRecord(record.id);
        onSelect(element);
      },
    });
  };

  return (
    <div className="pgve-selection-card">
      <div className="pgve-selection-head">
        <div className="pgve-selection-label">{buildElementLabel(element)}</div>
        <button type="button" aria-label="Hide element" title="Hide the selected element" onClick={onHide}>
          🙈 Hide
        </button>
      </div>
      <Breadcrumb element={element} onSelect={onSelect} />
    </div>
  );
}
