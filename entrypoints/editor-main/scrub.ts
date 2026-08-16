import type { EditsController } from './controller';

interface ScrubBounds {
  increment?: number;
  min?: number;
  max?: number;
}

/**
 * The value a drag step lands on.
 *
 * Reads the live record rather than whatever the closure captured when the drag began:
 * the pointer handler is registered once at pointerdown, so a closed-over value stays
 * frozen and every step of the drag would restart from the same number.
 */
export function scrubbedValue(
  controller: EditsController,
  element: Element,
  property: string,
  fallback: string,
  steps: number,
  { increment = 1, min = Number.NEGATIVE_INFINITY, max = Number.POSITIVE_INFINITY }: ScrubBounds = {},
): number {
  const raw = controller.recordFor(element, property)?.newValue ?? fallback;
  const current = Number.parseFloat(raw) || 0;
  const next = current + steps * increment;
  // Two decimals: enough for a tenth-of-a-pixel drag, without float noise in the record.
  return Math.min(max, Math.max(min, Number(next.toFixed(2))));
}
