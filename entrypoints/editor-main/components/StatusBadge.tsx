import { EyeIcon, HandIcon } from './icons';

interface StatusBadgeProps {
  previewing: boolean;
  browsing: boolean;
  onExitPreview: () => void;
  onExitBrowse: () => void;
}

export function StatusBadge({ previewing, browsing, onExitPreview, onExitBrowse }: StatusBadgeProps) {
  if (previewing) {
    return (
      <button type="button" className="pgve-badge" onClick={onExitPreview}>
        <EyeIcon /> Viewing original — Back to edited
      </button>
    );
  }
  if (browsing) {
    return (
      <button type="button" className="pgve-badge" onClick={onExitBrowse}>
        <HandIcon /> Browsing — switch to Edit to select
      </button>
    );
  }
  return null;
}
