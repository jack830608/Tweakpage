import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ModeSwitch } from './ModeSwitch';
import { CollapsibleSection } from './CollapsibleSection';
import { StatusBadge } from './StatusBadge';
import { OnboardingCard } from './OnboardingCard';

afterEach(cleanup);

const OPTIONS = [
  { value: 'edit', label: 'Edit' },
  { value: 'browse', label: 'Browse' },
] as const;

test('mode switch renders both options and marks the active one', () => {
  render(<ModeSwitch ariaLabel="Interaction mode" options={OPTIONS} value="edit" onChange={() => {}} />);
  expect(screen.getByRole('button', { name: 'Edit' }).getAttribute('aria-pressed')).toBe('true');
  expect(screen.getByRole('button', { name: 'Browse' }).getAttribute('aria-pressed')).toBe('false');
});

test('clicking the inactive option fires onChange; the active one does not', () => {
  const onChange = vi.fn();
  render(<ModeSwitch ariaLabel="Interaction mode" options={OPTIONS} value="edit" onChange={onChange} />);
  fireEvent.click(screen.getByRole('button', { name: 'Browse' }));
  expect(onChange).toHaveBeenCalledWith('browse');
  fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
  expect(onChange).toHaveBeenCalledTimes(1);
});

test('collapsible section hides children when closed and toggles', () => {
  const onToggle = vi.fn();
  const { rerender } = render(
    <CollapsibleSection title="Spacing" open={false} onToggle={onToggle}>
      <p>body</p>
    </CollapsibleSection>,
  );
  expect(screen.queryByText('body')).toBeNull();
  expect(screen.getByRole('button', { name: /Spacing/ }).getAttribute('aria-expanded')).toBe('false');
  fireEvent.click(screen.getByRole('button', { name: /Spacing/ }));
  expect(onToggle).toHaveBeenCalled();
  rerender(
    <CollapsibleSection title="Spacing" open onToggle={onToggle}>
      <p>body</p>
    </CollapsibleSection>,
  );
  expect(screen.getByText('body')).toBeTruthy();
});

test('status badge shows nothing by default, preview wins over browse, actions fire', () => {
  const onExitPreview = vi.fn();
  const onExitBrowse = vi.fn();
  const { rerender, container } = render(
    <StatusBadge previewing={false} browsing={false} onExitPreview={onExitPreview} onExitBrowse={onExitBrowse} />,
  );
  expect(container.innerHTML).toBe('');
  rerender(
    <StatusBadge previewing browsing onExitPreview={onExitPreview} onExitBrowse={onExitBrowse} />,
  );
  fireEvent.click(screen.getByRole('button', { name: /Viewing original/ }));
  expect(onExitPreview).toHaveBeenCalled();
  rerender(
    <StatusBadge previewing={false} browsing onExitPreview={onExitPreview} onExitBrowse={onExitBrowse} />,
  );
  fireEvent.click(screen.getByRole('button', { name: /Browsing/ }));
  expect(onExitBrowse).toHaveBeenCalled();
});

test('onboarding card lists three steps and dismisses', () => {
  const onDismiss = vi.fn();
  render(<OnboardingCard onDismiss={onDismiss} />);
  expect(screen.getAllByRole('listitem')).toHaveLength(3);
  fireEvent.click(screen.getByRole('button', { name: 'Got it' }));
  expect(onDismiss).toHaveBeenCalled();
});
