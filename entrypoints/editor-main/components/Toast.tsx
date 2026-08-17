import { useEffect } from 'react';

const AUTO_DISMISS_MS = 5000;

export interface ToastContent {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

interface ToastProps extends ToastContent {
  onDismiss: () => void;
}

export function Toast({ message, actionLabel, onAction, onDismiss }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [onDismiss]);
  return (
    <div className="twk-toast">
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
