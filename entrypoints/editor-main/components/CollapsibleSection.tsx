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
  return (
    <section className="twk-disclosure">
      <button type="button" className="twk-disclosure-header" data-section={sectionId} aria-expanded={open} onClick={onToggle}>
        <ChevronIcon open={open} /> {title}
        {aside}
      </button>
      {open && <div className="twk-disclosure-body">{children}</div>}
    </section>
  );
}
