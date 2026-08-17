import { EyeIcon, HandIcon } from './icons';
import { t } from '../../../lib/i18n';

interface StatusBadgeProps {
  previewing: boolean;
  browsing: boolean;
  onExitPreview: () => void;
  onExitBrowse: () => void;
}

export function StatusBadge({ previewing, browsing, onExitPreview, onExitBrowse }: StatusBadgeProps) {
  if (previewing) {
    return (
      <button type="button" className="twk-badge" aria-label={t('aria_viewing_original')} data-testid="viewing-original-back-to-edited" onClick={onExitPreview}>
        <EyeIcon /> {t('badge_original')}
      </button>
    );
  }
  if (browsing) {
    return (
      <button type="button" className="twk-badge" aria-label={t('aria_browsing')} data-testid="browsing-switch-to-edit" onClick={onExitBrowse}>
        <HandIcon /> {t('badge_browsing')}
      </button>
    );
  }
  return null;
}
