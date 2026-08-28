import { useRef, type PointerEvent as ReactPointerEvent } from 'react';

/**
 * Drag a property name sideways to change its number.
 *
 * The stylesheet has claimed this for a while — "the native spinner only shows on hover,
 * lands on top of the unit, and cannot be styled — the property name is the scrub handle
 * instead" — but nothing was ever wired to it. This is that.
 *
 * It writes nothing itself. It drives the field's own number input, through the value
 * setter React tracks, so the section's existing onChange runs exactly as it would if
 * somebody typed. One writer per property, unchanged: this is a second way to reach the
 * control, not a second control.
 *
 * The step is the field's own, which is why a page whose text is 15.4px stays sensible —
 * there is no sequence to snap to, so a drag from 15.4 lands on 16.4 rather than on
 * whatever a stepper would have decided 15.4 was closest to.
 */
export function useScrub(container: { current: HTMLElement | null }) {
  const drag = useRef<{ input: HTMLInputElement; startX: number; startValue: number } | null>(null);

  const numberInput = (): HTMLInputElement | null => {
    const input = container.current?.querySelector<HTMLInputElement>('input[type="number"]');
    return input && !input.disabled ? input : null;
  };

  /** Past React's value tracker, so a programmatic write still reaches onChange. */
  const write = (input: HTMLInputElement, next: number) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    setter?.call(input, String(next));
    input.dispatchEvent(new Event('input', { bubbles: true }));
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    // Left button only, and only where there is a number to move.
    if (event.button !== 0) return;
    const input = numberInput();
    if (!input) return;
    const startValue = Number(input.value);
    if (!Number.isFinite(startValue)) return;
    drag.current = { input, startX: event.clientX, startValue };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    const state = drag.current;
    if (!state) return;
    const step = Number(state.input.step) || 1;
    const unit = event.altKey ? step / 10 : event.shiftKey ? step * 10 : step;
    const next = state.startValue + Math.round(event.clientX - state.startX) * unit;
    const min = state.input.min === '' ? -Infinity : Number(state.input.min);
    // Rounded to the precision the step implies; floating point otherwise turns a drag
    // of 0.1 into 15.400000000000002.
    const decimals = (String(unit).split('.')[1] ?? '').length;
    write(state.input, Number(Math.max(min, next).toFixed(decimals)));
  };

  const end = (event: ReactPointerEvent<HTMLElement>) => {
    if (!drag.current) return;
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  return { scrubbable: numberInput, onPointerDown, onPointerMove, onPointerUp: end, onPointerCancel: end };
}
