import type { EditsController } from '../controller';

interface ResetButtonProps {
  controller: EditsController;
  element: Element;
  property: string;
}

export function ResetButton({ controller, element, property }: ResetButtonProps) {
  const record = controller.recordFor(element, property);
  if (!record) return <span className="pgve-reset-slot" aria-hidden="true" />;
  return (
    <button
      type="button"
      className="pgve-reset"
      aria-label={`Reset ${property}`}
      title="Reset to original"
      onClick={() => controller.deleteRecord(record.id)}
    >
      ↺
    </button>
  );
}
