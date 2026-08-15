import { fakeBrowser } from 'wxt/testing';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { PopupApp } from './PopupApp';
import { emptyPageEdits, type EditRecord } from '../../lib/edits/types';

afterEach(cleanup);
beforeEach(() => fakeBrowser.reset());

const record: EditRecord = {
  id: 'r1', selector: 'h1', fallbackSelectors: [], elementLabel: 'h1',
  type: 'text', property: 'textContent', oldValue: 'a', newValue: 'b',
  enabled: true, createdAt: 'n', updatedAt: 'n',
};

test('lists pages with edits and clears them', async () => {
  await fakeBrowser.storage.local.set({
    'page:https://example.com/landing': {
      ...emptyPageEdits('https://example.com/landing', 'Landing', '2026-08-16'),
      records: [record],
    },
  });
  render(<PopupApp />);
  expect(await screen.findByText('Landing')).toBeTruthy();
  expect(screen.getByText('1')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: /Clear edits for/ }));
  await waitFor(() => expect(screen.queryByText('Landing')).toBeNull());
  expect(await screen.findByText(/No saved edits yet/)).toBeTruthy();
});
