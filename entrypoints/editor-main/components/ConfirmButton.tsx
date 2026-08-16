import { useEffect, useRef, useState } from 'react';
import { t } from '../../../lib/i18n';

interface ConfirmButtonProps {
  label: string;
  ariaLabel: string;
  onConfirm: () => void;
  className?: string;
}

const RESET_MS = 4000;

/**
 * Two-step button for actions that throw away the only copy of something.
 *
 * A second click rather than a dialog: the click is already in the right place, and a
 * dialog inside a page we don't own would have to fight that page's styles and focus.
 */
export function ConfirmButton({ label, ariaLabel, onConfirm, className }: ConfirmButtonProps) {
  const [armed, setArmed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const disarm = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setArmed(false);
  };

  return (
    <button
      type="button"
      className={armed ? `${className ?? ''} is-armed`.trim() : className}
      aria-label={armed ? `${ariaLabel} — confirm` : ariaLabel}
      onClick={() => {
        if (armed) {
          disarm();
          onConfirm();
          return;
        }
        setArmed(true);
        timer.current = setTimeout(() => setArmed(false), RESET_MS);
      }}
      onBlur={disarm}
    >
      {armed ? t('confirm_again') : label}
    </button>
  );
}
