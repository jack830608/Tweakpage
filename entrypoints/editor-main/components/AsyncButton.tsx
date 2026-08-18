import { useEffect, useRef, useState, type ReactNode } from 'react';
import { CheckIcon, SpinnerIcon } from './icons';

type Phase = 'idle' | 'busy' | 'done';

/** Long enough to read the confirmation, short enough to not look stuck. */
const DONE_MS = 1600;

interface AsyncButtonProps {
  icon: ReactNode;
  label: string;
  busyLabel: string;
  doneLabel: string;
  ariaLabel: string;
  testId: string;
  title?: string;
  disabled?: boolean;
  /** Resolving to false means failure — the button returns to idle and the caller's toast tells the story. */
  run: () => Promise<unknown>;
}

/**
 * A button whose work takes real time.
 *
 * Uploading to S3 and compositing screenshots both take seconds; a button that does
 * nothing visible in between reads as broken and gets clicked again. While running it
 * says so and refuses re-entry; when the work lands, the confirmation appears where the
 * user is already looking — on the button itself — before the toast repeats it.
 */
export function AsyncButton({
  icon,
  label,
  busyLabel,
  doneLabel,
  ariaLabel,
  testId,
  title,
  disabled,
  run,
}: AsyncButtonProps) {
  const [phase, setPhase] = useState<Phase>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const onClick = async () => {
    if (phase !== 'idle') return;
    setPhase('busy');
    let ok: boolean;
    try {
      ok = (await run()) !== false;
    } catch {
      ok = false;
    }
    if (!ok) {
      setPhase('idle');
      return;
    }
    setPhase('done');
    timer.current = setTimeout(() => setPhase('idle'), DONE_MS);
  };

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      data-testid={testId}
      title={title}
      disabled={disabled || phase === 'busy'}
      aria-busy={phase === 'busy'}
      className={phase === 'done' ? 'twk-done' : undefined}
      onClick={() => void onClick()}
    >
      {phase === 'busy' ? <SpinnerIcon /> : phase === 'done' ? <CheckIcon /> : icon}{' '}
      {phase === 'busy' ? busyLabel : phase === 'done' ? doneLabel : label}
    </button>
  );
}
