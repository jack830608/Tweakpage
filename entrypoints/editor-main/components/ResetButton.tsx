import type { EditsController } from '../controller';
import { t } from '../../../lib/i18n';

interface ResetButtonProps {
  controller: EditsController;
  element: Element;
  property: string;
  /** Properties written alongside this one that must go with it — e.g. the
   *  border-style we add to make a border-width visible. Leaving one behind
   *  means "reset" doesn't put the element back the way it was. */
  companions?: string[];
}

export function ResetButton({ controller, element, property, companions }: ResetButtonProps) {
  const record = controller.recordFor(element, property);
  if (!record) return <span className="twk-reset-slot" aria-hidden="true" />;
  return (
    <button
      type="button"
      className="twk-reset"
      aria-label={t('aria_reset', [property])}
      data-testid={`reset-${property}`}
      title={t('tip_reset')}
      onClick={() =>
        companions?.length
          ? controller.resetProperties(element, [property, ...companions])
          : controller.deleteRecord(record.id)
      }
    >
      ↺
    </button>
  );
}
