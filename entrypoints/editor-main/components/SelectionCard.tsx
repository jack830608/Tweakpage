import { buildElementLabel } from '../../../lib/selector/generate';
import { Breadcrumb } from './Breadcrumb';

interface SelectionCardProps {
  element: Element;
  onSelect: (el: Element) => void;
}

export function SelectionCard({ element, onSelect }: SelectionCardProps) {
  return (
    <div className="pgve-selection-card">
      <div className="pgve-selection-label">{buildElementLabel(element)}</div>
      <Breadcrumb element={element} onSelect={onSelect} />
    </div>
  );
}
