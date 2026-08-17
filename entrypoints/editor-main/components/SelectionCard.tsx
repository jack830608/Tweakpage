import { useSyncExternalStore } from 'react';
import { buildElementLabel } from '../../../lib/selector/generate';
import type { EditsController } from '../controller';
import { Breadcrumb } from './Breadcrumb';
import { EyeIcon, EyeOffIcon } from './icons';
import { t } from '../../../lib/i18n';

interface SelectionCardProps {
  element: Element;
  controller: EditsController;
  onSelect: (el: Element) => void;
}

export function SelectionCard({ element, controller, onSelect }: SelectionCardProps) {
  useSyncExternalStore(controller.subscribe, controller.getPage);
  const similar = controller.similarTo(element);
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
          aria-label={hidden ? t('aria_unhide_element') : t('aria_hide_element')}
          title={hidden ? 'Show the element again' : 'Hide the selected element'}
          onClick={onToggleHide}
        >
          {hidden ? <><EyeIcon /> {t('unhide')}</> : <><EyeOffIcon /> {t('hide')}</>}
        </button>
      </div>
      <Breadcrumb element={element} onSelect={onSelect} />
      {similar && (
        <label className="pgve-similar">
          <input
            type="checkbox"
            aria-label={t('aria_apply_similar')}
            data-testid="apply-to-similar"
            checked={controller.appliesToSimilar(element)}
            onChange={(e) => controller.setSimilarScope(element, e.target.checked)}
          />
          {t('apply_similar', [similar.count])}
        </label>
      )}
    </div>
  );
}
