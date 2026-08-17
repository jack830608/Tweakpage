import { fakeBrowser } from 'wxt/testing';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { PopupApp } from './PopupApp';
import { emptyPageEdits, type EditRecord } from '../../lib/edits/types';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// fakeBrowser has no tab model, so tests declare which tabs exist.
let openTabs: Array<{ id: number; url: string; windowId?: number }> = [];
let closed: () => void;

beforeEach(() => {
  fakeBrowser.reset();
  openTabs = [];
  vi.spyOn(fakeBrowser.tabs, 'query').mockImplementation(((query: { active?: boolean }) =>
    Promise.resolve(query?.active ? openTabs.slice(0, 1) : openTabs)) as never);
  // happy-dom honours window.close() by tearing the document down, which leaves every
  // later test rendering into a dead page.
  closed = vi.fn();
  vi.spyOn(window, 'close').mockImplementation(() => closed());
});

const record: EditRecord = {
  id: 'r1', selector: 'h1', fallbackSelectors: [], elementLabel: 'h1',
  type: 'text', property: 'textContent', oldValue: 'a', newValue: 'b',
  enabled: true, createdAt: 'n', updatedAt: 'n',
};

async function seed(url: string, title: string): Promise<void> {
  await fakeBrowser.storage.local.set({
    [`page:${url}`]: { ...emptyPageEdits(url, title, '2026-08-16'), records: [record] },
  });
}

test('lists pages with edits and clears them', async () => {
  await seed('https://example.com/landing', 'Landing');
  openTabs = [{ id: 1, url: 'https://other.com/' }];
  render(<PopupApp />);
  expect(await screen.findByText('Landing')).toBeTruthy();
  expect(screen.getByText('1')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: /^Clear edits for/ }));
  expect(screen.getByText('Landing'), 'one click must not wipe the only copy').toBeTruthy();

  fireEvent.click(screen.getByRole('button', { name: /Clear edits for .* — confirm/ }));
  await waitFor(() => expect(screen.queryByText('Landing')).toBeNull());
  expect(await screen.findByText(/No saved edits yet/)).toBeTruthy();
});

test('the page you are on opens the editor instead of a second tab', async () => {
  await seed('https://example.com/landing', 'Landing');
  openTabs = [{ id: 7, url: 'https://example.com/landing?utm_source=x#hero' }];
  const create = vi.spyOn(fakeBrowser.tabs, 'create');
  const send = vi.spyOn(fakeBrowser.tabs, 'sendMessage').mockResolvedValue(undefined as never);
  render(<PopupApp />);

  // Tracking params and the hash don't change which page it is — the storage key ignores them.
  const here = await screen.findByText('Applied on this page');
  expect(here.closest('li')?.className).toContain('pop-current');
  expect(screen.queryByText('example.com/landing'), 'the URL line gives way to the marker').toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Edit https://example.com/landing' }));

  await waitFor(() => expect(send).toHaveBeenCalledWith(7, { type: 'tweakpage:toggle' }));
  expect(create).not.toHaveBeenCalled();
  expect(closed).toHaveBeenCalled();
});

test('a page already open in another tab is focused, not duplicated', async () => {
  await seed('https://example.com/landing', 'Landing');
  openTabs = [
    { id: 1, url: 'https://current.com/' },
    { id: 9, url: 'https://example.com/landing', windowId: 3 },
  ];
  const create = vi.spyOn(fakeBrowser.tabs, 'create');
  const update = vi.spyOn(fakeBrowser.tabs, 'update').mockResolvedValue(undefined as never);
  const focus = vi.spyOn(fakeBrowser.windows, 'update').mockResolvedValue(undefined as never);
  render(<PopupApp />);

  fireEvent.click(await screen.findByRole('button', { name: 'Open https://example.com/landing' }));
  await waitFor(() => expect(update).toHaveBeenCalledWith(9, { active: true }));
  expect(focus).toHaveBeenCalledWith(3, { focused: true });
  expect(create).not.toHaveBeenCalled();
});

test('a page that is open nowhere gets a new tab', async () => {
  await seed('https://example.com/landing', 'Landing');
  openTabs = [{ id: 1, url: 'https://current.com/' }];
  const create = vi.spyOn(fakeBrowser.tabs, 'create').mockResolvedValue(undefined as never);
  render(<PopupApp />);

  fireEvent.click(await screen.findByRole('button', { name: 'Open https://example.com/landing' }));
  await waitFor(() =>
    expect(create).toHaveBeenCalledWith({ url: 'https://example.com/landing' }),
  );
});
