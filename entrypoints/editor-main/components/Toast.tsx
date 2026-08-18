import { useEffect } from 'react';

const AUTO_DISMISS_MS = 5000;
// Failures cost the reader more to miss, so they get longer to be seen.
const ERROR_DISMISS_MS = 8000;

export type ToastKind = 'success' | 'error' | 'info';

export interface ToastContent {
  message: string;
  kind?: ToastKind;
  actionLabel?: string;
  onAction?: () => void;
}

const ICONS: Record<ToastKind, string> = {
  success: 'M20 6 9 17l-5-5',
  error: 'M12 8v5m0 3.5v.5M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',
  info: 'M12 16v-5m0-3.5v-.5M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z',
};

export function Toast({ message, kind = 'info', actionLabel, onAction, onDismiss }: ToastContent & { onDismiss: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, kind === 'error' ? ERROR_DISMISS_MS : AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [onDismiss, kind]);
  return (
    <div className="twk-toast" role="status" data-kind={kind} data-testid="toast">
      <span className="twk-toast-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d={ICONS[kind]} />
        </svg>
      </span>
      <span>{message}</span>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={() => {
            onAction();
            onDismiss();
          }}
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
