import type { EditsController } from '../controller';

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
  if (!record) return <span className="pgve-reset-slot" aria-hidden="true" />;
  return (
    <button
      type="button"
      className="pgve-reset"
      aria-label={`Reset ${property}`}
      title="Reset to original"
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
