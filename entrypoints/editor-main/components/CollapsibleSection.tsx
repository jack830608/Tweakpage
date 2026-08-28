import { useLayoutEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { ChevronIcon } from './icons';

interface CollapsibleSectionProps {
  title: string;
  sectionId?: string;
  open: boolean;
  onToggle: () => void;
  /** Shown at the right of the header — a status that should be readable while closed. */
  aside?: ReactNode;
  children: ReactNode;
}

export function CollapsibleSection({ title, sectionId, open, onToggle, aside, children }: CollapsibleSectionProps) {
  const header = useRef<HTMLButtonElement>(null);
  /**
   * Opening a section near the bottom of a scrolled panel puts its contents below the
   * fold, so the click appears to do nothing. `nearest` scrolls only when it has to, and
   * leaves a section opened in the middle of the panel exactly where it was.
   *
   * A layout effect because the body renders on the same commit as the state change.
   */
  useLayoutEffect(() => {
    if (open) header.current?.scrollIntoView({ block: 'nearest' });
  }, [open]);
  return (
    <section className="twk-disclosure">
      <button ref={header} type="button" className="twk-disclosure-header" data-section={sectionId} aria-expanded={open} onClick={onToggle}>
        <ChevronIcon open={open} /> {title}
        {aside}
      </button>
      {open && <div className="twk-disclosure-body">{children}</div>}
    </section>
  );
}
